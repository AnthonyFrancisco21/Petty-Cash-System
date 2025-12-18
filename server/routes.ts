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

      const voucher = await storage.updateVoucherStatus(parseInt(id), "approved", userId);
      if (!voucher) {
        return res.status(404).json({ message: "Voucher not found" });
      }

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

      const voucher = await storage.updateVoucherStatus(parseInt(id), "rejected", userId);
      if (!voucher) {
        return res.status(404).json({ message: "Voucher not found" });
      }

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
      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating replenishment request:", error);
      res.status(500).json({ message: "Failed to create replenishment request" });
    }
  });

  return httpServer;
}
