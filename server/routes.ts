import type { Express } from "express";
import { storage } from "./storage";
import {
  insertVoucherSchema,
  insertChartOfAccountSchema,
  insertPettyCashFundSchema,
} from "@shared/schema";
import { z } from "zod";
import multer from "multer";

// Configure multer for file uploads
const upload = multer({
  dest: "server/uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

function generateVoucherNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `PCV-${year}${month}-${random}`;
}

// Role-based authorization middleware
function requireRole(...allowedRoles: string[]) {
  return async (req: any, res: any, next: any) => {
    const userIdRaw = req.user?.id;
    if (!userIdRaw) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId =
      typeof userIdRaw === "string" ? parseInt(userIdRaw) : userIdRaw;
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (!allowedRoles.includes(user.role)) {
      return res
        .status(403)
        .json({ message: "Forbidden: Insufficient permissions" });
    }

    req.userRecord = user;
    next();
  };
}

export async function registerRoutes(app: Express): Promise<void> {
  // Auth middleware helper using passport sessions
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const parsedId = typeof userId === "string" ? parseInt(userId) : userId;
      const user = await storage.getUser(parsedId);
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

  app.patch(
    "/api/users/:id/role",
    isAuthenticated,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const { role } = req.body;

        if (!["preparer", "approver", "admin"].includes(role)) {
          return res.status(400).json({ message: "Invalid role" });
        }

        const user = await storage.updateUserRole(parseInt(id), role);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        res.json(user);
      } catch (error) {
        console.error("Error updating user role:", error);
        res.status(500).json({ message: "Failed to update user role" });
      }
    }
  );

  // Vouchers routes
  app.get("/api/vouchers", isAuthenticated, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const limit = req.query.limit
        ? parseInt(String(req.query.limit))
        : undefined;
      const offset = req.query.offset
        ? parseInt(String(req.query.offset))
        : undefined;
      const vouchers = await storage.getVouchersWithRelations(
        status,
        limit,
        offset
      );
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
      const userIdRaw = req.user.id;
      const userId =
        typeof userIdRaw === "string" ? parseInt(userIdRaw) : userIdRaw;

      // Validate required fields
      if (
        !req.body.payee ||
        !req.body.date ||
        !req.body.items ||
        !Array.isArray(req.body.items) ||
        req.body.items.length === 0
      ) {
        return res.status(400).json({
          message:
            "Missing required fields: payee, date, and items array are required",
        });
      }

      // Validate and calculate total amount
      let totalAmount = 0;
      const validatedItems = [];

      for (const item of req.body.items) {
        if (!item.description || !item.amount) {
          return res.status(400).json({
            message: "Each item must have description and amount",
          });
        }

        const amount = parseFloat(item.amount);
        if (isNaN(amount) || amount <= 0) {
          return res
            .status(400)
            .json({ message: "Item amount must be a positive number" });
        }

        totalAmount += amount;

        validatedItems.push({
          description: item.description,
          amount: item.amount,
          chartOfAccountId: item.chartOfAccountId
            ? parseInt(item.chartOfAccountId)
            : null,
          invoiceNumber: item.invoiceNumber || null,
          vatAmount: item.vatAmount || null,
          amountWithheld: item.amountWithheld || null,
        });
      }

      const voucherData = {
        date: new Date(req.body.date),
        payee: req.body.payee,
        totalAmount: totalAmount.toFixed(2),
        approvedById: req.body.approvedById || null,
        status: req.body.status || "pending",
        requestedById: userId,
        voucherNumber: generateVoucherNumber(),
        items: validatedItems,
      };

      const voucher = await storage.createVoucher(voucherData);

      // Log voucher creation
      await storage.createAuditLog({
        entityType: "voucher",
        entityId: voucher.id.toString(),
        action: "created",
        newValue: voucher,
        userId,
        description: `Created voucher ${voucher.voucherNumber} for ${
          req.body.payee
        } - ${totalAmount.toFixed(2)}`,
      });

      res.status(201).json(voucher);
    } catch (error) {
      console.error("Error creating voucher:", error);
      res.status(500).json({ message: "Failed to create voucher" });
    }
  });

  app.patch(
    "/api/vouchers/:id/approve",
    isAuthenticated,
    requireRole("approver", "admin"),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const userIdRaw = req.user.id;
        const userId =
          typeof userIdRaw === "string" ? parseInt(userIdRaw) : userIdRaw;

        const oldVoucher = await storage.getVoucherById(parseInt(id));
        const voucher = await storage.updateVoucherStatus(
          parseInt(id),
          "approved",
          userId
        );
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
    }
  );

  app.patch(
    "/api/vouchers/:id/reject",
    isAuthenticated,
    requireRole("approver", "admin"),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const userIdRaw = req.user.id;
        const userId =
          typeof userIdRaw === "string" ? parseInt(userIdRaw) : userIdRaw;

        const oldVoucher = await storage.getVoucherById(parseInt(id));
        const voucher = await storage.updateVoucherStatus(
          parseInt(id),
          "rejected",
          userId
        );
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
    }
  );

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

  app.post(
    "/api/chart-of-accounts",
    isAuthenticated,
    requireRole("preparer", "admin"),
    async (req, res) => {
      try {
        const result = insertChartOfAccountSchema.safeParse(req.body);
        if (!result.success) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: result.error.errors });
        }

        const account = await storage.createChartOfAccount(result.data);
        res.status(201).json(account);
      } catch (error) {
        console.error("Error creating chart of account:", error);
        res.status(500).json({ message: "Failed to create chart of account" });
      }
    }
  );

  app.patch(
    "/api/chart-of-accounts/:id",
    isAuthenticated,
    requireRole("preparer", "admin"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const result = insertChartOfAccountSchema.safeParse(req.body);
        if (!result.success) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: result.error.errors });
        }

        const account = await storage.updateChartOfAccount(
          parseInt(id),
          result.data
        );
        if (!account) {
          return res
            .status(404)
            .json({ message: "Chart of account not found" });
        }
        res.json(account);
      } catch (error) {
        console.error("Error updating chart of account:", error);
        res.status(500).json({ message: "Failed to update chart of account" });
      }
    }
  );

  app.delete(
    "/api/chart-of-accounts/:id",
    isAuthenticated,
    requireRole("preparer", "admin"),
    async (req, res) => {
      try {
        const { id } = req.params;
        await storage.deleteChartOfAccount(parseInt(id));
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting chart of account:", error);
        res.status(500).json({ message: "Failed to delete chart of account" });
      }
    }
  );

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

  app.post(
    "/api/fund",
    isAuthenticated,
    requireRole("preparer", "admin"),
    async (req: any, res) => {
      try {
        const userIdRaw = req.user.id;
        const userId =
          typeof userIdRaw === "string" ? parseInt(userIdRaw) : userIdRaw;

        if (!req.body.imprestAmount) {
          return res
            .status(400)
            .json({ message: "Imprest amount is required" });
        }

        const amount = parseFloat(req.body.imprestAmount);
        if (isNaN(amount) || amount <= 0) {
          return res
            .status(400)
            .json({ message: "Imprest amount must be a positive number" });
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
    }
  );

  app.patch(
    "/api/fund/:id",
    isAuthenticated,
    requireRole("preparer", "admin"),
    async (req, res) => {
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
    }
  );

  // Replenishment routes
  app.get("/api/replenishment-requests", isAuthenticated, async (req, res) => {
    try {
      const requests = await storage.getReplenishmentRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching replenishment requests:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch replenishment requests" });
    }
  });

  app.post(
    "/api/replenishment-requests",
    isAuthenticated,
    requireRole("preparer", "admin"),
    async (req: any, res) => {
      try {
        const userIdRaw = req.user.id;
        const userId =
          typeof userIdRaw === "string" ? parseInt(userIdRaw) : userIdRaw;

        if (
          !req.body.voucherIds ||
          !Array.isArray(req.body.voucherIds) ||
          req.body.voucherIds.length === 0
        ) {
          return res.status(400).json({
            message: "At least one voucher must be selected for replenishment",
          });
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
        res
          .status(500)
          .json({ message: "Failed to create replenishment request" });
      }
    }
  );

  // Audit log routes
  app.get(
    "/api/audit-logs",
    isAuthenticated,
    requireRole("preparer", "admin"),
    async (req, res) => {
      try {
        const { entityType, entityId, limit } = req.query;

        if (limit) {
          const logs = await storage.getRecentAuditLogs(
            parseInt(limit as string)
          );
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
    }
  );

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

  app.post(
    "/api/budgets",
    isAuthenticated,
    requireRole("preparer", "admin"),
    async (req: any, res) => {
      try {
        const userIdRaw = req.user.id;
        const userId =
          typeof userIdRaw === "string" ? parseInt(userIdRaw) : userIdRaw;

        if (
          !req.body.chartOfAccountId ||
          !req.body.budgetAmount ||
          !req.body.period ||
          !req.body.startDate ||
          !req.body.endDate
        ) {
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
    }
  );

  app.patch(
    "/api/budgets/:id",
    isAuthenticated,
    requireRole("preparer", "admin"),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const userIdRaw = req.user.id;
        const userId =
          typeof userIdRaw === "string" ? parseInt(userIdRaw) : userIdRaw;

        const oldBudget = await storage.getAccountBudgetById(parseInt(id));
        const budget = await storage.updateAccountBudget(
          parseInt(id),
          req.body
        );

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
    }
  );

  app.delete(
    "/api/budgets/:id",
    isAuthenticated,
    requireRole("preparer", "admin"),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const userIdRaw = req.user.id;
        const userId =
          typeof userIdRaw === "string" ? parseInt(userIdRaw) : userIdRaw;

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
    }
  );

  // Voucher attachment routes
  app.get(
    "/api/vouchers/:id/attachments",
    isAuthenticated,
    async (req, res) => {
      try {
        const { id } = req.params;
        const attachments = await storage.getVoucherAttachments(parseInt(id));
        res.json(attachments);
      } catch (error) {
        console.error("Error fetching attachments:", error);
        res.status(500).json({ message: "Failed to fetch attachments" });
      }
    }
  );

  app.post(
    "/api/vouchers/:id/attachments",
    isAuthenticated,
    (req: any, res: any, next: any) => {
      upload.single("file")(req, res, (err: any) => {
        if (err) {
          return res
            .status(400)
            .json({ message: "File upload error", error: err.message });
        }
        next();
      });
    },
    async (req: any, res) => {
      try {
        console.log(
          "Attachment upload request received for voucher:",
          req.params.id
        );
        console.log(
          "File info:",
          req.file
            ? {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                path: req.file.path,
              }
            : "No file"
        );

        const { id } = req.params;
        const userIdRaw = req.user.id;
        const userId =
          typeof userIdRaw === "string" ? parseInt(userIdRaw) : userIdRaw;

        if (!req.file) {
          console.log("No file uploaded in request");
          return res.status(400).json({ message: "No file uploaded" });
        }

        // Check if voucher exists
        try {
          const voucher = await storage.getVoucherById(parseInt(id));
          console.log(
            `Voucher lookup result:`,
            voucher ? `Found voucher ${voucher.id}` : "Voucher not found"
          );
          if (!voucher) {
            console.log(`Returning 404 for non-existent voucher ${id}`);
            return res.status(404).json({ message: "Voucher not found" });
          }
        } catch (dbError) {
          console.error(`Database error checking voucher ${id}:`, dbError);
          return res
            .status(500)
            .json({ message: "Database error checking voucher" });
        }

        const fs = require("fs").promises;
        const path = require("path");

        // Generate unique filename
        const uniqueName = `${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 15)}-${req.file.originalname}`;
        const filePath = path.resolve("server/uploads", uniqueName);

        console.log(`Generated file path: ${filePath}`);
        console.log(`Temp file location: ${req.file.path}`);

        // Move file from temp location to permanent location
        try {
          await fs.rename(req.file.path, filePath);
          console.log("File moved successfully");
        } catch (fileError) {
          console.error("Error moving file:", fileError);
          return res.status(500).json({ message: "Failed to save file" });
        }

        const attachmentData = {
          voucherId: parseInt(id),
          fileName: req.file.originalname,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
          filePath: filePath,
          uploadedById: userId,
        };

        try {
          const attachment = await storage.createVoucherAttachment(
            attachmentData
          );
          console.log("Attachment created successfully:", attachment.id);

          try {
            await storage.createAuditLog({
              entityType: "voucher",
              entityId: id,
              action: "attachment_added",
              newValue: {
                fileName: req.file.originalname,
                fileType: req.file.mimetype,
              },
              userId,
              description: `Added attachment: ${req.file.originalname}`,
            });
            console.log("Audit log created successfully");
          } catch (auditError) {
            console.error("Error creating audit log:", auditError);
            // Don't fail the request for audit log errors
          }

          console.log("Attachment upload completed successfully");
          res.status(201).json(attachment);
        } catch (dbError) {
          console.error("Error creating attachment in database:", dbError);
          return res
            .status(500)
            .json({ message: "Failed to create attachment record" });
        }
      } catch (error) {
        console.error("Error creating attachment:", error);
        res.status(500).json({ message: "Failed to create attachment" });
      }
    }
  );

  // Download attachment route
  app.get(
    "/api/attachments/:id/download",
    isAuthenticated,
    async (req, res) => {
      try {
        const { id } = req.params;

        // Get attachment info from database
        const attachment = await storage.getVoucherAttachmentById(parseInt(id));

        if (!attachment) {
          return res.status(404).json({ message: "Attachment not found" });
        }

        const fs = require("fs");
        const path = require("path");
        const fullPath = path.resolve(attachment.filePath);

        // Check if file exists
        if (!fs.existsSync(fullPath)) {
          return res.status(404).json({ message: "File not found on disk" });
        }

        // Set appropriate headers
        res.setHeader("Content-Type", attachment.fileType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${attachment.fileName}"`
        );

        // Stream the file
        const fileStream = fs.createReadStream(fullPath);
        fileStream.pipe(res);

        fileStream.on("error", (error: any) => {
          console.error("Error streaming file:", error);
          res.status(500).json({ message: "Error downloading file" });
        });
      } catch (error) {
        console.error("Error downloading attachment:", error);
        res.status(500).json({ message: "Failed to download attachment" });
      }
    }
  );

  app.delete("/api/attachments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userIdRaw = req.user.id;
      const userId =
        typeof userIdRaw === "string" ? parseInt(userIdRaw) : userIdRaw;

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
  app.get(
    "/api/reports/disbursement-summary",
    isAuthenticated,
    async (req, res) => {
      try {
        const { startDate, endDate, groupBy } = req.query;

        const start = startDate
          ? new Date(startDate as string)
          : new Date(new Date().getFullYear(), 0, 1);
        const end = endDate ? new Date(endDate as string) : new Date();

        const vouchers = await storage.getVouchersWithRelations();

        const filteredVouchers = vouchers.filter((v: any) => {
          const voucherDate = new Date(v.date);
          return (
            voucherDate >= start &&
            voucherDate <= end &&
            v.status !== "rejected"
          );
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
          // Sum amounts from all items in the voucher
          let voucherAmount = 0;
          let voucherVat = 0;
          let voucherWithheld = 0;

          v.items?.forEach((item: any) => {
            voucherAmount += parseFloat(item.amount) || 0;
            voucherVat += parseFloat(item.vatAmount || "0");
            voucherWithheld += parseFloat(item.amountWithheld || "0");
          });

          const netAmount = voucherAmount; // For now, net amount is total amount

          summary.totalAmount += voucherAmount;
          summary.totalVat += voucherVat;
          summary.totalWithheld += voucherWithheld;
          summary.totalNetAmount += netAmount;

          // Group by account - now we need to group by each item's account
          v.items?.forEach((item: any) => {
            const accountCode = item.chartOfAccount?.code || "Uncategorized";
            if (!summary.byAccount[accountCode]) {
              summary.byAccount[accountCode] = {
                code: accountCode,
                name: item.chartOfAccount?.name || "Uncategorized",
                amount: 0,
                vat: 0,
                withheld: 0,
                netAmount: 0,
                count: 0,
              };
            }
            const itemAmount = parseFloat(item.amount) || 0;
            const itemVat = parseFloat(item.vatAmount || "0");
            const itemWithheld = parseFloat(item.amountWithheld || "0");

            summary.byAccount[accountCode].amount += itemAmount;
            summary.byAccount[accountCode].vat += itemVat;
            summary.byAccount[accountCode].withheld += itemWithheld;
            summary.byAccount[accountCode].netAmount += itemAmount;
            summary.byAccount[accountCode].count += 1;
          });

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
          summary.byMonth[monthKey].amount += voucherAmount;
          summary.byMonth[monthKey].vat += voucherVat;
          summary.byMonth[monthKey].withheld += voucherWithheld;
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
          byMonth: Object.values(summary.byMonth).sort((a: any, b: any) =>
            a.month.localeCompare(b.month)
          ),
        });
      } catch (error) {
        console.error("Error generating disbursement summary:", error);
        res
          .status(500)
          .json({ message: "Failed to generate disbursement summary" });
      }
    }
  );
}
