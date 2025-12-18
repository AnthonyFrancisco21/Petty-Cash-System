import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertVoucherSchema, insertChartOfAccountSchema, insertPettyCashFundSchema } from "@shared/schema";
import { z } from "zod";

function generateVoucherNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `PCV-${year}${month}-${random}`;
}

// Role-based authorization middleware
function requireRole(...allowedRoles: string[]) {
  return async (req: any, res: any, next: any) => {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
    }
    
    req.userRecord = user;
    next();
  };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Users routes
  app.get("/api/users", isAuthenticated, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch("/api/users/:id/role", isAuthenticated, requireRole("admin", "cash_manager"), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!["requester", "approver", "cash_manager", "admin"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const user = await storage.updateUserRole(id, role);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Vouchers routes
  app.get("/api/vouchers", isAuthenticated, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const vouchers = await storage.getVouchersWithRelations(status);
      res.json(vouchers);
    } catch (error) {
      console.error("Error fetching vouchers:", error);
      res.status(500).json({ message: "Failed to fetch vouchers" });
    }
  });

  app.get("/api/vouchers/stats", isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getVoucherStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching voucher stats:", error);
      res.status(500).json({ message: "Failed to fetch voucher stats" });
    }
  });

  app.post("/api/vouchers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Validate required fields
      if (!req.body.payee || !req.body.description || !req.body.amount || !req.body.date) {
        return res.status(400).json({ message: "Missing required fields: payee, description, amount, and date are required" });
      }

      const amount = parseFloat(req.body.amount);
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: "Amount must be a positive number" });
      }

      const voucherData = {
        date: new Date(req.body.date),
        payee: req.body.payee,
        description: req.body.description,
        amount: req.body.amount,
        invoiceNumber: req.body.invoiceNumber || null,
        amountNetOfVat: req.body.amountNetOfVat || null,
        vatAmount: req.body.vatAmount || null,
        amountWithheld: req.body.amountWithheld || null,
        chartOfAccountId: req.body.chartOfAccountId ? parseInt(req.body.chartOfAccountId) : null,
        approvedById: req.body.approvedById || null,
        status: req.body.status || "pending",
        requestedById: userId,
        voucherNumber: generateVoucherNumber(),
      };

      const voucher = await storage.createVoucher(voucherData);

      // Log voucher creation
      await storage.createAuditLog({
        entityType: "voucher",
        entityId: voucher.id.toString(),
        action: "created",
        newValue: voucher,
        userId,
        description: `Created voucher ${voucher.voucherNumber} for ${req.body.payee} - ${req.body.amount}`,
      });

      res.status(201).json(voucher);
    } catch (error) {
      console.error("Error creating voucher:", error);
      res.status(500).json({ message: "Failed to create voucher" });
    }
  });

  app.patch("/api/vouchers/:id/approve", isAuthenticated, requireRole("approver", "cash_manager", "admin"), async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;

      const oldVoucher = await storage.getVoucherById(parseInt(id));
      const voucher = await storage.updateVoucherStatus(parseInt(id), "approved", userId);
      if (!voucher) {
        return res.status(404).json({ message: "Voucher not found" });
      }

      // Log approval
      await storage.createAuditLog({
        entityType: "voucher",
        entityId: id,
        action: "approved",
        oldValue: { status: oldVoucher?.status },
        newValue: { status: "approved", approvedById: userId },
        userId,
        description: `Approved voucher ${voucher.voucherNumber}`,
      });

      res.json(voucher);
    } catch (error) {
      console.error("Error approving voucher:", error);
      res.status(500).json({ message: "Failed to approve voucher" });
    }
  });

  app.patch("/api/vouchers/:id/reject", isAuthenticated, requireRole("approver", "cash_manager", "admin"), async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;

      const oldVoucher = await storage.getVoucherById(parseInt(id));
      const voucher = await storage.updateVoucherStatus(parseInt(id), "rejected", userId);
      if (!voucher) {
        return res.status(404).json({ message: "Voucher not found" });
      }

      // Log rejection
      await storage.createAuditLog({
        entityType: "voucher",
        entityId: id,
        action: "rejected",
        oldValue: { status: oldVoucher?.status },
        newValue: { status: "rejected", approvedById: userId },
        userId,
        description: `Rejected voucher ${voucher.voucherNumber}`,
      });

      res.json(voucher);
    } catch (error) {
      console.error("Error rejecting voucher:", error);
      res.status(500).json({ message: "Failed to reject voucher" });
    }
  });

  // Chart of Accounts routes
  app.get("/api/chart-of-accounts", isAuthenticated, async (req, res) => {
    try {
      const accounts = await storage.getChartOfAccounts();
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching chart of accounts:", error);
      res.status(500).json({ message: "Failed to fetch chart of accounts" });
    }
  });

  app.post("/api/chart-of-accounts", isAuthenticated, requireRole("cash_manager", "admin"), async (req, res) => {
    try {
      const result = insertChartOfAccountSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid data", errors: result.error.errors });
      }

      const account = await storage.createChartOfAccount(result.data);
      res.status(201).json(account);
    } catch (error) {
      console.error("Error creating chart of account:", error);
      res.status(500).json({ message: "Failed to create chart of account" });
    }
  });

  app.delete("/api/chart-of-accounts/:id", isAuthenticated, requireRole("cash_manager", "admin"), async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteChartOfAccount(parseInt(id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting chart of account:", error);
      res.status(500).json({ message: "Failed to delete chart of account" });
    }
  });

  // Petty Cash Fund routes
  app.get("/api/fund", isAuthenticated, async (req, res) => {
    try {
      const fund = await storage.getFund();
      if (!fund) {
        return res.status(404).json({ message: "Fund not configured" });
      }
      res.json(fund);
    } catch (error) {
      console.error("Error fetching fund:", error);
      res.status(500).json({ message: "Failed to fetch fund" });
    }
  });

  app.post("/api/fund", isAuthenticated, requireRole("cash_manager", "admin"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      if (!req.body.imprestAmount) {
        return res.status(400).json({ message: "Imprest amount is required" });
      }

      const amount = parseFloat(req.body.imprestAmount);
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: "Imprest amount must be a positive number" });
      }

      const fundData = {
        imprestAmount: req.body.imprestAmount,
        currentBalance: req.body.currentBalance || req.body.imprestAmount,
        managerId: userId,
      };

      const fund = await storage.createFund(fundData);
      res.status(201).json(fund);
    } catch (error) {
      console.error("Error creating fund:", error);
      res.status(500).json({ message: "Failed to create fund" });
    }
  });

  app.patch("/api/fund/:id", isAuthenticated, requireRole("cash_manager", "admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const fund = await storage.updateFund(parseInt(id), req.body);
      if (!fund) {
        return res.status(404).json({ message: "Fund not found" });
      }
      res.json(fund);
    } catch (error) {
      console.error("Error updating fund:", error);
      res.status(500).json({ message: "Failed to update fund" });
    }
  });

  // Replenishment routes
  app.get("/api/replenishment-requests", isAuthenticated, async (req, res) => {
    try {
      const requests = await storage.getReplenishmentRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching replenishment requests:", error);
      res.status(500).json({ message: "Failed to fetch replenishment requests" });
    }
  });

  app.post("/api/replenishment-requests", isAuthenticated, requireRole("cash_manager", "admin"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      if (!req.body.voucherIds || !Array.isArray(req.body.voucherIds) || req.body.voucherIds.length === 0) {
        return res.status(400).json({ message: "At least one voucher must be selected for replenishment" });
      }

      const requestData = {
        requestDate: new Date(),
        totalAmount: req.body.totalAmount || "0",
        totalVat: req.body.totalVat || "0",
        totalWithheld: req.body.totalWithheld || "0",
        totalNetAmount: req.body.totalNetAmount || "0",
        requestedById: userId,
        voucherIds: req.body.voucherIds,
        status: "pending",
      };

      const request = await storage.createReplenishmentRequest(requestData);

      // Log the replenishment action
      await storage.createAuditLog({
        entityType: "replenishment",
        entityId: request.id.toString(),
        action: "created",
        newValue: request,
        userId,
        description: `Created replenishment request for ${req.body.voucherIds.length} vouchers totaling ${req.body.totalAmount}`,
      });

      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating replenishment request:", error);
      res.status(500).json({ message: "Failed to create replenishment request" });
    }
  });

  // Audit log routes
  app.get("/api/audit-logs", isAuthenticated, requireRole("cash_manager", "admin"), async (req, res) => {
    try {
      const { entityType, entityId, limit } = req.query;
      
      if (limit) {
        const logs = await storage.getRecentAuditLogs(parseInt(limit as string));
        return res.json(logs);
      }
      
      const logs = await storage.getAuditLogs(
        entityType as string | undefined,
        entityId as string | undefined
      );
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Budget tracking routes
  app.get("/api/budgets", isAuthenticated, async (req, res) => {
    try {
      const budgets = await storage.getAccountBudgets();
      res.json(budgets);
    } catch (error) {
      console.error("Error fetching budgets:", error);
      res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });

  app.post("/api/budgets", isAuthenticated, requireRole("cash_manager", "admin"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      if (!req.body.chartOfAccountId || !req.body.budgetAmount || !req.body.period || !req.body.startDate || !req.body.endDate) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const budgetData = {
        chartOfAccountId: parseInt(req.body.chartOfAccountId),
        budgetAmount: req.body.budgetAmount,
        period: req.body.period,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        alertThreshold: req.body.alertThreshold || "80",
      };

      const budget = await storage.createAccountBudget(budgetData);

      await storage.createAuditLog({
        entityType: "budget",
        entityId: budget.id.toString(),
        action: "created",
        newValue: budget,
        userId,
        description: `Created budget of ${req.body.budgetAmount} for account`,
      });

      res.status(201).json(budget);
    } catch (error) {
      console.error("Error creating budget:", error);
      res.status(500).json({ message: "Failed to create budget" });
    }
  });

  app.patch("/api/budgets/:id", isAuthenticated, requireRole("cash_manager", "admin"), async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const oldBudget = await storage.getAccountBudgetById(parseInt(id));
      const budget = await storage.updateAccountBudget(parseInt(id), req.body);
      
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }

      await storage.createAuditLog({
        entityType: "budget",
        entityId: id,
        action: "updated",
        oldValue: oldBudget,
        newValue: budget,
        userId,
        description: `Updated budget`,
      });

      res.json(budget);
    } catch (error) {
      console.error("Error updating budget:", error);
      res.status(500).json({ message: "Failed to update budget" });
    }
  });

  app.delete("/api/budgets/:id", isAuthenticated, requireRole("cash_manager", "admin"), async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      await storage.deleteAccountBudget(parseInt(id));

      await storage.createAuditLog({
        entityType: "budget",
        entityId: id,
        action: "deleted",
        userId,
        description: `Deleted budget`,
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting budget:", error);
      res.status(500).json({ message: "Failed to delete budget" });
    }
  });

  // Voucher attachment routes
  app.get("/api/vouchers/:id/attachments", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const attachments = await storage.getVoucherAttachments(parseInt(id));
      res.json(attachments);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      res.status(500).json({ message: "Failed to fetch attachments" });
    }
  });

  app.post("/api/vouchers/:id/attachments", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      if (!req.body.fileName || !req.body.fileType || !req.body.fileData || !req.body.fileSize) {
        return res.status(400).json({ message: "Missing required attachment fields" });
      }

      const attachmentData = {
        voucherId: parseInt(id),
        fileName: req.body.fileName,
        fileType: req.body.fileType,
        fileSize: req.body.fileSize,
        fileData: req.body.fileData,
        uploadedById: userId,
      };

      const attachment = await storage.createVoucherAttachment(attachmentData);

      await storage.createAuditLog({
        entityType: "voucher",
        entityId: id,
        action: "attachment_added",
        newValue: { fileName: req.body.fileName, fileType: req.body.fileType },
        userId,
        description: `Added attachment: ${req.body.fileName}`,
      });

      res.status(201).json(attachment);
    } catch (error) {
      console.error("Error creating attachment:", error);
      res.status(500).json({ message: "Failed to create attachment" });
    }
  });

  app.delete("/api/attachments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      await storage.deleteVoucherAttachment(parseInt(id));

      await storage.createAuditLog({
        entityType: "attachment",
        entityId: id,
        action: "deleted",
        userId,
        description: `Deleted attachment`,
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting attachment:", error);
      res.status(500).json({ message: "Failed to delete attachment" });
    }
  });

  // Disbursement summary reports route
  app.get("/api/reports/disbursement-summary", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate, groupBy } = req.query;
      
      const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      const vouchers = await storage.getVouchersWithRelations();
      
      const filteredVouchers = vouchers.filter((v: any) => {
        const voucherDate = new Date(v.date);
        return voucherDate >= start && voucherDate <= end && v.status !== 'rejected';
      });

      // Group by chart of account if requested
      const summary: any = {
        totalAmount: 0,
        totalVat: 0,
        totalWithheld: 0,
        totalNetAmount: 0,
        voucherCount: filteredVouchers.length,
        byAccount: {} as Record<string, any>,
        byMonth: {} as Record<string, any>,
      };

      filteredVouchers.forEach((v: any) => {
        const amount = parseFloat(v.amount) || 0;
        const vat = parseFloat(v.vatAmount || "0");
        const withheld = parseFloat(v.amountWithheld || "0");
        const netAmount = parseFloat(v.amountNetOfVat || v.amount);

        summary.totalAmount += amount;
        summary.totalVat += vat;
        summary.totalWithheld += withheld;
        summary.totalNetAmount += netAmount;

        // Group by account
        const accountCode = v.chartOfAccount?.code || "Uncategorized";
        if (!summary.byAccount[accountCode]) {
          summary.byAccount[accountCode] = {
            code: accountCode,
            name: v.chartOfAccount?.name || "Uncategorized",
            amount: 0,
            vat: 0,
            withheld: 0,
            netAmount: 0,
            count: 0,
          };
        }
        summary.byAccount[accountCode].amount += amount;
        summary.byAccount[accountCode].vat += vat;
        summary.byAccount[accountCode].withheld += withheld;
        summary.byAccount[accountCode].netAmount += netAmount;
        summary.byAccount[accountCode].count += 1;

        // Group by month
        const monthKey = new Date(v.date).toISOString().slice(0, 7);
        if (!summary.byMonth[monthKey]) {
          summary.byMonth[monthKey] = {
            month: monthKey,
            amount: 0,
            vat: 0,
            withheld: 0,
            netAmount: 0,
            count: 0,
          };
        }
        summary.byMonth[monthKey].amount += amount;
        summary.byMonth[monthKey].vat += vat;
        summary.byMonth[monthKey].withheld += withheld;
        summary.byMonth[monthKey].netAmount += netAmount;
        summary.byMonth[monthKey].count += 1;
      });

      res.json({
        period: { startDate: start, endDate: end },
        summary: {
          totalAmount: summary.totalAmount.toFixed(2),
          totalVat: summary.totalVat.toFixed(2),
          totalWithheld: summary.totalWithheld.toFixed(2),
          totalNetAmount: summary.totalNetAmount.toFixed(2),
          voucherCount: summary.voucherCount,
        },
        byAccount: Object.values(summary.byAccount),
        byMonth: Object.values(summary.byMonth).sort((a: any, b: any) => a.month.localeCompare(b.month)),
      });
    } catch (error) {
      console.error("Error generating disbursement summary:", error);
      res.status(500).json({ message: "Failed to generate disbursement summary" });
    }
  });

  return httpServer;
}
