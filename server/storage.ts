import {
  users,
  vouchers,
  chartOfAccounts,
  pettyCashFund,
  replenishmentRequests,
  type User,
  type UpsertUser,
  type Voucher,
  type InsertVoucher,
  type ChartOfAccount,
  type InsertChartOfAccount,
  type PettyCashFund,
  type InsertPettyCashFund,
  type ReplenishmentRequest,
  type InsertReplenishmentRequest,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, inArray } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(id: string, role: string): Promise<User | undefined>;

  // Voucher operations
  getVouchers(status?: string): Promise<Voucher[]>;
  getVoucherById(id: number): Promise<Voucher | undefined>;
  createVoucher(voucher: InsertVoucher & { voucherNumber: string }): Promise<Voucher>;
  updateVoucherStatus(id: number, status: string, approvedById?: string): Promise<Voucher | undefined>;
  getVoucherStats(): Promise<{ totalDisbursed: string; pendingCount: number; approvedCount: number }>;
  getVouchersWithRelations(status?: string): Promise<any[]>;

  // Chart of Accounts operations
  getChartOfAccounts(): Promise<ChartOfAccount[]>;
  getChartOfAccountById(id: number): Promise<ChartOfAccount | undefined>;
  createChartOfAccount(coa: InsertChartOfAccount): Promise<ChartOfAccount>;
  deleteChartOfAccount(id: number): Promise<void>;

  // Petty Cash Fund operations
  getFund(): Promise<PettyCashFund | undefined>;
  createFund(fund: InsertPettyCashFund): Promise<PettyCashFund>;
  updateFund(id: number, data: Partial<InsertPettyCashFund>): Promise<PettyCashFund | undefined>;

  // Replenishment operations
  createReplenishmentRequest(request: InsertReplenishmentRequest): Promise<ReplenishmentRequest>;
  getReplenishmentRequests(): Promise<ReplenishmentRequest[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.firstName);
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Voucher operations
  async getVouchers(status?: string): Promise<Voucher[]> {
    if (status) {
      return await db
        .select()
        .from(vouchers)
        .where(eq(vouchers.status, status))
        .orderBy(desc(vouchers.date));
    }
    return await db.select().from(vouchers).orderBy(desc(vouchers.date));
  }

  async getVoucherById(id: number): Promise<Voucher | undefined> {
    const [voucher] = await db.select().from(vouchers).where(eq(vouchers.id, id));
    return voucher;
  }

  async createVoucher(voucher: InsertVoucher & { voucherNumber: string }): Promise<Voucher> {
    const [created] = await db.insert(vouchers).values(voucher).returning();

    // Update fund balance
    const fund = await this.getFund();
    if (fund) {
      const newBalance = parseFloat(fund.currentBalance) - parseFloat(voucher.amount);
      await db
        .update(pettyCashFund)
        .set({ currentBalance: newBalance.toString(), updatedAt: new Date() })
        .where(eq(pettyCashFund.id, fund.id));
    }

    return created;
  }

  async updateVoucherStatus(id: number, status: string, approvedById?: string): Promise<Voucher | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (approvedById) {
      updateData.approvedById = approvedById;
    }
    const [voucher] = await db
      .update(vouchers)
      .set(updateData)
      .where(eq(vouchers.id, id))
      .returning();
    return voucher;
  }

  async getVoucherStats(): Promise<{ totalDisbursed: string; pendingCount: number; approvedCount: number }> {
    const result = await db
      .select({
        totalDisbursed: sql<string>`COALESCE(SUM(CASE WHEN ${vouchers.status} != 'rejected' THEN ${vouchers.amount}::numeric ELSE 0 END), 0)::text`,
        pendingCount: sql<number>`COUNT(CASE WHEN ${vouchers.status} = 'pending' THEN 1 END)::int`,
        approvedCount: sql<number>`COUNT(CASE WHEN ${vouchers.status} = 'approved' THEN 1 END)::int`,
      })
      .from(vouchers);

    return result[0] || { totalDisbursed: "0", pendingCount: 0, approvedCount: 0 };
  }

  async getVouchersWithRelations(status?: string): Promise<any[]> {
    const voucherList = await this.getVouchers(status);
    const result = [];

    for (const v of voucherList) {
      const requester = v.requestedById ? await this.getUser(v.requestedById) : null;
      const approver = v.approvedById ? await this.getUser(v.approvedById) : null;
      const coa = v.chartOfAccountId ? await this.getChartOfAccountById(v.chartOfAccountId) : null;

      result.push({
        ...v,
        requester,
        approver,
        chartOfAccount: coa,
      });
    }

    return result;
  }

  // Chart of Accounts operations
  async getChartOfAccounts(): Promise<ChartOfAccount[]> {
    return await db.select().from(chartOfAccounts).orderBy(chartOfAccounts.code);
  }

  async getChartOfAccountById(id: number): Promise<ChartOfAccount | undefined> {
    const [coa] = await db.select().from(chartOfAccounts).where(eq(chartOfAccounts.id, id));
    return coa;
  }

  async createChartOfAccount(coa: InsertChartOfAccount): Promise<ChartOfAccount> {
    const [created] = await db.insert(chartOfAccounts).values(coa).returning();
    return created;
  }

  async deleteChartOfAccount(id: number): Promise<void> {
    await db.delete(chartOfAccounts).where(eq(chartOfAccounts.id, id));
  }

  // Petty Cash Fund operations
  async getFund(): Promise<PettyCashFund | undefined> {
    const [fund] = await db.select().from(pettyCashFund).limit(1);
    return fund;
  }

  async createFund(fund: InsertPettyCashFund): Promise<PettyCashFund> {
    const [created] = await db.insert(pettyCashFund).values(fund).returning();
    return created;
  }

  async updateFund(id: number, data: Partial<InsertPettyCashFund>): Promise<PettyCashFund | undefined> {
    const [updated] = await db
      .update(pettyCashFund)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pettyCashFund.id, id))
      .returning();
    return updated;
  }

  // Replenishment operations
  async createReplenishmentRequest(request: InsertReplenishmentRequest): Promise<ReplenishmentRequest> {
    const [created] = await db.insert(replenishmentRequests).values(request).returning();

    // Mark vouchers as replenished
    if (request.voucherIds && request.voucherIds.length > 0) {
      await db
        .update(vouchers)
        .set({ status: "replenished", updatedAt: new Date() })
        .where(inArray(vouchers.id, request.voucherIds));

      // Restore fund balance
      const fund = await this.getFund();
      if (fund) {
        await db
          .update(pettyCashFund)
          .set({
            currentBalance: fund.imprestAmount,
            lastReplenishmentDate: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(pettyCashFund.id, fund.id));
      }
    }

    return created;
  }

  async getReplenishmentRequests(): Promise<ReplenishmentRequest[]> {
    return await db
      .select()
      .from(replenishmentRequests)
      .orderBy(desc(replenishmentRequests.requestDate));
  }
}

export const storage = new DatabaseStorage();
