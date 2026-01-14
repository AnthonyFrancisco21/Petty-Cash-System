import {
  users,
  vouchers,
  voucherItems,
  chartOfAccounts,
  pettyCashFund,
  replenishmentRequests,
  auditLogs,
  accountBudgets,
  voucherAttachments,
  type User,
  type UpsertUser,
  type Voucher,
  type InsertVoucher,
  type VoucherItem,
  type InsertVoucherItem,
  type ChartOfAccount,
  type InsertChartOfAccount,
  type PettyCashFund,
  type InsertPettyCashFund,
  type ReplenishmentRequest,
  type InsertReplenishmentRequest,
  type AuditLog,
  type InsertAuditLog,
  type AccountBudget,
  type InsertAccountBudget,
  type VoucherAttachment,
  type InsertVoucherAttachment,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, inArray, gte, lte, between } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number | string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: any): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(id: number, role: string): Promise<User | undefined>;

  // Voucher operations
  getVouchers(status?: string): Promise<Voucher[]>;
  getVoucherById(id: number): Promise<Voucher | undefined>;
  createVoucher(voucher: {
    voucherNumber: string;
    date: Date;
    payee: string;
    totalAmount: string;
    requestedById: number;
    approvedById?: number | null;
    status: string;
    supportingDocsSubmitted?: Date | null;
    items: InsertVoucherItem[];
  }): Promise<Voucher>;
  updateVoucherStatus(
    id: number,
    status: string,
    approvedById?: number
  ): Promise<Voucher | undefined>;
  getVoucherStats(): Promise<{
    totalDisbursed: string;
    pendingCount: number;
    approvedCount: number;
  }>;
  getVouchersWithRelations(status?: string): Promise<any[]>;

  // Chart of Accounts operations
  getChartOfAccounts(): Promise<ChartOfAccount[]>;
  getChartOfAccountById(id: number): Promise<ChartOfAccount | undefined>;
  createChartOfAccount(coa: InsertChartOfAccount): Promise<ChartOfAccount>;
  updateChartOfAccount(
    id: number,
    data: Partial<InsertChartOfAccount>
  ): Promise<ChartOfAccount | undefined>;
  deleteChartOfAccount(id: number): Promise<void>;

  // Petty Cash Fund operations
  getFund(): Promise<PettyCashFund | undefined>;
  createFund(fund: InsertPettyCashFund): Promise<PettyCashFund>;
  updateFund(
    id: number,
    data: Partial<InsertPettyCashFund>
  ): Promise<PettyCashFund | undefined>;

  // Replenishment operations
  createReplenishmentRequest(
    request: InsertReplenishmentRequest & { voucherIds: number[] }
  ): Promise<ReplenishmentRequest>;
  getReplenishmentRequests(): Promise<ReplenishmentRequest[]>;

  // Audit log operations
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(entityType?: string, entityId?: string): Promise<any[]>;
  getRecentAuditLogs(limit?: number): Promise<any[]>;
  getAuditLogsPaginated(
    limit: number,
    offset: number,
    filters?: {
      entityType?: string;
      entityId?: string;
      userId?: number;
      action?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ logs: any[]; total: number }>;
  cleanupObsoleteAuditLogs(): Promise<number>;

  // Budget tracking operations
  createAccountBudget(budget: InsertAccountBudget): Promise<AccountBudget>;
  getAccountBudgets(): Promise<any[]>;
  getAccountBudgetById(id: number): Promise<AccountBudget | undefined>;
  updateAccountBudget(
    id: number,
    data: Partial<InsertAccountBudget>
  ): Promise<AccountBudget | undefined>;
  deleteAccountBudget(id: number): Promise<void>;
  getBudgetSpending(
    chartOfAccountId: number,
    startDate: Date,
    endDate: Date
  ): Promise<string>;

  // Voucher attachment operations
  createVoucherAttachment(
    attachment: InsertVoucherAttachment
  ): Promise<VoucherAttachment>;
  getVoucherAttachments(voucherId: number): Promise<VoucherAttachment[]>;
  getVoucherAttachmentById(id: number): Promise<VoucherAttachment | undefined>;
  deleteVoucherAttachment(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: any): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUser(id: number | string): Promise<User | undefined> {
    const parsedId = typeof id === "string" ? parseInt(id) : id;
    const [user] = await db.select().from(users).where(eq(users.id, parsedId));
    return user;
  }

  // User operations

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.firstName);
  }

  async updateUserRole(id: number, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Voucher operations
  async getVouchers(
    status?: string,
    limit?: number,
    offset?: number
  ): Promise<Voucher[]> {
    const builder = db.select().from(vouchers);
    if (status) {
      builder.where(eq(vouchers.status, status));
    }
    builder.orderBy(desc(vouchers.date));
    if (typeof limit === "number") {
      builder.limit(limit);
    }
    if (typeof offset === "number") {
      builder.offset(offset);
    }
    return await builder;
  }

  async getVoucherById(id: number): Promise<Voucher | undefined> {
    const [voucher] = await db
      .select()
      .from(vouchers)
      .where(eq(vouchers.id, id));
    return voucher;
  }

  async createVoucher(voucher: {
    voucherNumber: string;
    date: Date;
    payee: string;
    totalAmount: string;
    requestedById: number;
    approvedById?: number | null;
    status: string;
    supportingDocsSubmitted?: Date | null;
    items: InsertVoucherItem[];
  }): Promise<Voucher> {
    // Start transaction
    const result = await db.transaction(async (tx) => {
      // Create voucher header
      const [created] = await tx
        .insert(vouchers)
        .values({
          voucherNumber: voucher.voucherNumber,
          date: voucher.date,
          payee: voucher.payee,
          totalAmount: voucher.totalAmount,
          requestedById: voucher.requestedById,
          approvedById: voucher.approvedById,
          status: voucher.status,
          supportingDocsSubmitted: voucher.supportingDocsSubmitted,
        })
        .returning();

      // Create voucher items
      if (voucher.items && voucher.items.length > 0) {
        await tx.insert(voucherItems).values(
          voucher.items.map((item) => ({
            voucherId: created.id,
            description: item.description,
            amount: item.amount,
            chartOfAccountId: item.chartOfAccountId,
            vatAmount: item.vatAmount,
            amountWithheld: item.amountWithheld,
          }))
        );
      }

      // Update fund balance (only if fund exists)
      const fund = await tx.select().from(pettyCashFund).limit(1);
      if (fund.length > 0) {
        const currentBalance = parseFloat(fund[0].currentBalance);
        const voucherAmount = parseFloat(voucher.totalAmount);

        // Check if fund has sufficient balance
        if (currentBalance < voucherAmount) {
          throw new Error(
            `Insufficient fund balance. Available: ${currentBalance}, Required: ${voucherAmount}`
          );
        }

        const newBalance = currentBalance - voucherAmount;
        await tx
          .update(pettyCashFund)
          .set({ currentBalance: newBalance.toString(), updatedAt: new Date() })
          .where(eq(pettyCashFund.id, fund[0].id));
      }
      // If no fund exists, allow voucher creation but log a warning
      // This allows the system to work even without fund configuration

      return created;
    });

    return result;
  }

  async updateVoucherStatus(
    id: number,
    status: string,
    approvedById?: number
  ): Promise<Voucher | undefined> {
    const updateData: any = { status };
    if (approvedById) {
      updateData.approvedById = approvedById;
    }
    const [voucher] = await db
      .update(vouchers)
      .set(updateData as any)
      .where(eq(vouchers.id, id))
      .returning();
    return voucher;
  }

  async getVoucherStats(): Promise<{
    totalDisbursed: string;
    pendingCount: number;
    approvedCount: number;
  }> {
    const result = await db
      .select({
        totalDisbursed: sql<string>`COALESCE(SUM(CASE WHEN ${vouchers.status} != 'rejected' THEN ${vouchers.totalAmount}::numeric ELSE 0 END), 0)::text`,
        pendingCount: sql<number>`COUNT(CASE WHEN ${vouchers.status} = 'pending' THEN 1 END)::int`,
        approvedCount: sql<number>`COUNT(CASE WHEN ${vouchers.status} = 'approved' THEN 1 END)::int`,
      })
      .from(vouchers);

    return (
      result[0] || { totalDisbursed: "0", pendingCount: 0, approvedCount: 0 }
    );
  }

  async getVouchersWithRelations(
    status?: string,
    limit?: number,
    offset?: number
  ): Promise<any[]> {
    const voucherList = await this.getVouchers(status, limit, offset);
    const result = [];

    for (const v of voucherList) {
      const requester = v.requestedById
        ? await this.getUser(v.requestedById)
        : null;
      const approver = v.approvedById
        ? await this.getUser(v.approvedById)
        : null;

      // Get voucher items with their chart of accounts
      const items = await db
        .select()
        .from(voucherItems)
        .leftJoin(
          chartOfAccounts,
          eq(voucherItems.chartOfAccountId, chartOfAccounts.id)
        )
        .where(eq(voucherItems.voucherId, v.id));

      const voucherItemsWithCoa = items.map((item) => ({
        ...item.voucher_items,
        chartOfAccount: item.chart_of_accounts,
      }));

      // Get attachment count
      const attachments = await this.getVoucherAttachments(v.id);
      const attachmentCount = attachments.length;

      result.push({
        ...v,
        requester,
        approver,
        items: voucherItemsWithCoa,
        attachmentCount,
      });
    }

    return result;
  }

  // Chart of Accounts operations
  async getChartOfAccounts(): Promise<ChartOfAccount[]> {
    return await db
      .select()
      .from(chartOfAccounts)
      .orderBy(chartOfAccounts.code);
  }

  async getChartOfAccountById(id: number): Promise<ChartOfAccount | undefined> {
    const [coa] = await db
      .select()
      .from(chartOfAccounts)
      .where(eq(chartOfAccounts.id, id));
    return coa;
  }

  async createChartOfAccount(
    coa: InsertChartOfAccount
  ): Promise<ChartOfAccount> {
    const [created] = await db
      .insert(chartOfAccounts)
      .values(coa as any)
      .returning();
    return created;
  }

  async updateChartOfAccount(
    id: number,
    data: Partial<InsertChartOfAccount>
  ): Promise<ChartOfAccount | undefined> {
    const [updated] = await db
      .update(chartOfAccounts)
      .set(data as any)
      .where(eq(chartOfAccounts.id, id))
      .returning();
    return updated;
  }

  async deleteChartOfAccount(id: number): Promise<void> {
    // Check for references in voucherItems
    const voucherItemRefs = await db
      .select()
      .from(voucherItems)
      .where(eq(voucherItems.chartOfAccountId, id));

    if (voucherItemRefs.length > 0) {
      throw new Error(
        `Cannot delete chart of account: it is referenced by ${voucherItemRefs.length} voucher item(s)`
      );
    }

    // Check for references in accountBudgets
    const budgetRefs = await db
      .select()
      .from(accountBudgets)
      .where(eq(accountBudgets.chartOfAccountId, id));

    if (budgetRefs.length > 0) {
      throw new Error(
        `Cannot delete chart of account: it is referenced by ${budgetRefs.length} budget(s)`
      );
    }

    await db.delete(chartOfAccounts).where(eq(chartOfAccounts.id, id));
  }

  // Petty Cash Fund operations
  async getFund(): Promise<PettyCashFund | undefined> {
    const [fund] = await db.select().from(pettyCashFund).limit(1);
    return fund;
  }

  async createFund(fund: InsertPettyCashFund): Promise<PettyCashFund> {
    const [created] = await db
      .insert(pettyCashFund)
      .values(fund as any)
      .returning();
    return created;
  }

  async updateFund(
    id: number,
    data: Partial<InsertPettyCashFund>
  ): Promise<PettyCashFund | undefined> {
    const [updated] = await db
      .update(pettyCashFund)
      .set(data as any)
      .where(eq(pettyCashFund.id, id))
      .returning();
    return updated;
  }

  // Replenishment operations
  async createReplenishmentRequest(
    request: InsertReplenishmentRequest & { voucherIds: number[] }
  ): Promise<ReplenishmentRequest> {
    const [created] = await db
      .insert(replenishmentRequests)
      .values(request as any)
      .returning();

    // Mark vouchers as replenished
    if (request.voucherIds && request.voucherIds.length > 0) {
      await db
        .update(vouchers)
        .set({ status: "replenished" })
        .where(inArray(vouchers.id, request.voucherIds));

      // Restore fund balance
      const fund = await this.getFund();
      if (fund) {
        await db
          .update(pettyCashFund)
          .set({
            currentBalance: fund.imprestAmount,
            lastReplenishmentDate: new Date(),
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

  // Audit log operations
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db
      .insert(auditLogs)
      .values(log as any)
      .returning();
    return created;
  }

  async getAuditLogs(entityType?: string, entityId?: string): Promise<any[]> {
    let query = db.select().from(auditLogs);

    if (entityType && entityId) {
      const logs = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.entityType, entityType),
            eq(auditLogs.entityId, entityId)
          )
        )
        .orderBy(desc(auditLogs.timestamp));

      const result = [];
      for (const log of logs) {
        const user = log.userId ? await this.getUser(log.userId) : null;
        result.push({ ...log, user });
      }
      return result;
    } else if (entityType) {
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entityType, entityType))
        .orderBy(desc(auditLogs.timestamp));

      const result = [];
      for (const log of logs) {
        const user = log.userId ? await this.getUser(log.userId) : null;
        result.push({ ...log, user });
      }
      return result;
    }

    const logs = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.timestamp));
    const result = [];
    for (const log of logs) {
      const user = log.userId ? await this.getUser(log.userId) : null;
      result.push({ ...log, user });
    }
    return result;
  }

  async getRecentAuditLogs(limit: number = 50): Promise<any[]> {
    const logs = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);

    const result = [];
    for (const log of logs) {
      const user = log.userId ? await this.getUser(log.userId) : null;
      result.push({ ...log, user });
    }
    return result;
  }

  async getAuditLogsPaginated(
    limit: number,
    offset: number,
    filters?: {
      entityType?: string;
      entityId?: string;
      userId?: number;
      action?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ logs: any[]; total: number }> {
    let whereConditions = [];

    if (filters?.entityType) {
      whereConditions.push(eq(auditLogs.entityType, filters.entityType));
    }
    if (filters?.entityId) {
      whereConditions.push(eq(auditLogs.entityId, filters.entityId));
    }
    if (filters?.userId) {
      whereConditions.push(eq(auditLogs.userId, filters.userId));
    }
    if (filters?.action) {
      whereConditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters?.startDate) {
      whereConditions.push(gte(auditLogs.timestamp, filters.startDate));
    }
    if (filters?.endDate) {
      whereConditions.push(lte(auditLogs.timestamp, filters.endDate));
    }

    const whereClause =
      whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(whereClause);

    const total = totalResult[0]?.count || 0;

    // Get paginated logs
    const logs = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit)
      .offset(offset);

    const result = [];
    for (const log of logs) {
      const user = log.userId ? await this.getUser(log.userId) : null;
      result.push({ ...log, user });
    }

    return { logs: result, total };
  }

  async cleanupObsoleteAuditLogs(): Promise<number> {
    // Delete audit logs older than 1 year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const result = await db
      .delete(auditLogs)
      .where(lte(auditLogs.timestamp, oneYearAgo));

    return result.rowCount || 0;
  }

  // Budget tracking operations
  async createAccountBudget(
    budget: InsertAccountBudget
  ): Promise<AccountBudget> {
    const [created] = await db
      .insert(accountBudgets)
      .values(budget as any)
      .returning();
    return created;
  }

  async getAccountBudgets(): Promise<any[]> {
    const budgets = await db
      .select()
      .from(accountBudgets)
      .orderBy(accountBudgets.chartOfAccountId);

    const result = [];
    for (const budget of budgets) {
      const coa = await this.getChartOfAccountById(budget.chartOfAccountId);
      const spending = await this.getBudgetSpending(
        budget.chartOfAccountId,
        budget.startDate,
        budget.endDate
      );
      result.push({
        ...budget,
        chartOfAccount: coa,
        currentSpending: spending,
        percentageUsed:
          parseFloat(budget.budgetAmount) > 0
            ? (
                (parseFloat(spending) / parseFloat(budget.budgetAmount)) *
                100
              ).toFixed(2)
            : "0",
      });
    }
    return result;
  }

  async getAccountBudgetById(id: number): Promise<AccountBudget | undefined> {
    const [budget] = await db
      .select()
      .from(accountBudgets)
      .where(eq(accountBudgets.id, id));
    return budget;
  }

  async updateAccountBudget(
    id: number,
    data: Partial<InsertAccountBudget>
  ): Promise<AccountBudget | undefined> {
    const [updated] = await db
      .update(accountBudgets)
      .set(data as any)
      .where(eq(accountBudgets.id, id))
      .returning();
    return updated;
  }

  async deleteAccountBudget(id: number): Promise<void> {
    await db.delete(accountBudgets).where(eq(accountBudgets.id, id));
  }

  async getBudgetSpending(
    chartOfAccountId: number,
    startDate: Date,
    endDate: Date
  ): Promise<string> {
    const result = await db
      .select({
        total: sql<string>`COALESCE(SUM(${voucherItems.amount}::numeric), 0)::text`,
      })
      .from(voucherItems)
      .innerJoin(vouchers, eq(voucherItems.voucherId, vouchers.id))
      .where(
        and(
          eq(voucherItems.chartOfAccountId, chartOfAccountId),
          gte(vouchers.date, startDate),
          lte(vouchers.date, endDate),
          sql`${vouchers.status} != 'rejected'`
        )
      );
    return result[0]?.total || "0";
  }

  // Voucher attachment operations
  async createVoucherAttachment(
    attachment: InsertVoucherAttachment
  ): Promise<VoucherAttachment> {
    const [created] = await db
      .insert(voucherAttachments)
      .values(attachment as any)
      .returning();
    return created;
  }

  async getVoucherAttachments(voucherId: number): Promise<VoucherAttachment[]> {
    return await db
      .select()
      .from(voucherAttachments)
      .where(eq(voucherAttachments.voucherId, voucherId))
      .orderBy(desc(voucherAttachments.uploadedAt));
  }

  async getVoucherAttachmentById(
    id: number
  ): Promise<VoucherAttachment | undefined> {
    const [attachment] = await db
      .select()
      .from(voucherAttachments)
      .where(eq(voucherAttachments.id, id));
    return attachment;
  }

  async deleteVoucherAttachment(id: number): Promise<void> {
    // Get attachment info first to delete the file
    const [attachment] = await db
      .select()
      .from(voucherAttachments)
      .where(eq(voucherAttachments.id, id));

    if (attachment) {
      // Delete file from disk if it exists
      try {
        const fs = require("fs").promises;
        const path = require("path");
        const fullPath = path.resolve(attachment.filePath);
        await fs.unlink(fullPath);
      } catch (error) {
        // File might not exist, continue with database deletion
        console.warn(`Could not delete file for attachment ${id}:`, error);
      }
    }

    await db.delete(voucherAttachments).where(eq(voucherAttachments.id, id));
  }
}

export const storage = new DatabaseStorage();
