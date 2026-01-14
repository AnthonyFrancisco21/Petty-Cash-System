import type { Express, Response } from "express";
import { storage } from "./storage";
import {
  insertVoucherSchema,
  insertChartOfAccountSchema,
  insertPettyCashFundSchema,
  insertReplenishmentRequestSchema,
} from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for file uploads (old multer and uploads attchments code kept for reference)
/* const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "server", "uploads");
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate a temporary filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: multerStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
}); */

// Define where files are stored physically on the server
const UPLOADS_DIR = path.join(process.cwd(), "server", "uploads");

// Auto-create the directory if it doesn't exist
if (!fs.existsSync(UPLOADS_DIR)) {
  console.log(`[System] Creating uploads directory at: ${UPLOADS_DIR}`);
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure Multer for Disk Storage
const uploadStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    // Sanitize filename and add timestamp to prevent collisions
    const ext = path.extname(file.originalname);
    const name = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9]/g, "_");
    const uniqueName = `${Date.now()}-${name}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: uploadStorage,
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
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

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
        voucherNumber: req.body.voucherNumber,
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
        if (error instanceof Error && error.message.includes("Cannot delete")) {
          return res.status(400).json({ message: error.message });
        }
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
    requireRole("approver", "admin"),
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

        const result = insertReplenishmentRequestSchema.safeParse(requestData);
        if (!result.success) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: result.error.errors });
        }

        const request = await storage.createReplenishmentRequest(result.data);

        // Log the replenishment action
        await storage.createAuditLog({
          entityType: "replenishment",
          entityId: request.id.toString(),
          action: "created",
          newValue: request,
          userId,
          description: `Created replenishment request for ${result.data.voucherIds.length} vouchers totaling ${result.data.totalAmount}`,
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
    requireRole("approver"),
    async (req, res) => {
      try {
        const {
          entityType,
          entityId,
          limit,
          offset,
          userId,
          action,
          startDate,
          endDate,
        } = req.query;

        // If limit and offset are provided, use paginated version
        if (limit && offset) {
          const filters = {
            entityType: entityType as string,
            entityId: entityId as string,
            userId: userId ? parseInt(userId as string) : undefined,
            action: action as string,
            startDate: startDate ? new Date(startDate as string) : undefined,
            endDate: endDate ? new Date(endDate as string) : undefined,
          };

          const result = await storage.getAuditLogsPaginated(
            parseInt(limit as string),
            parseInt(offset as string),
            filters
          );
          return res.json(result);
        }

        // Legacy support for old endpoints
        if (limit) {
          const logs = await storage.getRecentAuditLogs(
            parseInt(limit as string)
          );
          return res.json({ logs, total: logs.length });
        }

        const logs = await storage.getAuditLogs(
          entityType as string | undefined,
          entityId as string | undefined
        );
        res.json({ logs, total: logs.length });
      } catch (error) {
        console.error("Error fetching audit logs:", error);
        res.status(500).json({ message: "Failed to fetch audit logs" });
      }
    }
  );

  // Cleanup obsolete audit logs
  app.delete(
    "/api/audit-logs/cleanup",
    isAuthenticated,
    requireRole("admin"),
    async (req, res) => {
      try {
        const deletedCount = await storage.cleanupObsoleteAuditLogs();
        res.json({ message: `Cleaned up ${deletedCount} obsolete audit logs` });
      } catch (error) {
        console.error("Error cleaning up audit logs:", error);
        res.status(500).json({ message: "Failed to cleanup audit logs" });
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
  // 1. GET Attachments
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

  // 2. POST Attachment (Upload)
  app.post(
    "/api/vouchers/:id/attachments",
    isAuthenticated,
    upload.single("file"), // Middleware processes file before the async function below
    async (req: any, res: any) => {
      // Validation: Did Multer receive a file?
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { id } = req.params;
      const voucherId = parseInt(id);

      // Validation: Invalid ID?
      if (isNaN(voucherId)) {
        // Clean up uploaded file since request is invalid
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Invalid voucher ID" });
      }

      console.log(
        `[Upload] Received file for Voucher ${voucherId}: ${req.file.originalname}`
      );

      try {
        const userId = req.user?.id
          ? typeof req.user.id === "string"
            ? parseInt(req.user.id)
            : req.user.id
          : null;
        if (!userId) {
          fs.unlinkSync(req.file.path); // Cleanup
          return res.status(401).json({ message: "Unauthorized" });
        }

        // Check if Voucher Exists
        const voucher = await storage.getVoucherById(voucherId);
        if (!voucher) {
          fs.unlinkSync(req.file.path); // Cleanup
          return res.status(404).json({ message: "Voucher not found" });
        }

        // Calculate Relative Path for DB (e.g., "server/uploads/123-file.pdf")
        const relativePath = path.relative(process.cwd(), req.file.path);

        // Prepare DB Record
        const attachmentData = {
          voucherId: voucherId,
          fileName: req.file.originalname,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
          filePath: relativePath, // MATCHES SCHEMA NOW
          uploadedById: userId,
        };

        // Insert into DB
        const attachment = await storage.createVoucherAttachment(
          attachmentData
        );

        // Audit Log (Fire and forget)
        storage
          .createAuditLog({
            entityType: "voucher",
            entityId: String(id),
            action: "attachment_added",
            newValue: { fileName: req.file.originalname },
            userId,
            description: `Added attachment: ${req.file.originalname}`,
          })
          .catch((err) => console.error("Audit log failed:", err));

        console.log(`[Upload] Success: Attachment ID ${attachment.id}`);
        res.status(201).json(attachment);
      } catch (error) {
        console.error("[Upload] Error:", error);

        // Cleanup file if DB insert failed
        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlink(req.file.path, (err) => {
            if (err) console.error("Cleanup failed:", err);
          });
        }

        return res
          .status(500)
          .json({ message: "Failed to save attachment record" });
      }
    }
  );

  // 3. DELETE Attachment
  app.delete(
    "/api/vouchers/:id/attachments/:attachmentId",
    isAuthenticated,
    async (req: any, res: Response) => {
      try {
        const { attachmentId } = req.params;
        const attachment = await storage.getVoucherAttachmentById(
          parseInt(attachmentId)
        );

        if (attachment) {
          // 1. Delete file from disk
          const fullPath = path.resolve(process.cwd(), attachment.filePath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          } else {
            console.warn(`[Delete] File not found on disk: ${fullPath}`);
          }

          // 2. Delete record from DB
          await storage.deleteVoucherAttachment(parseInt(attachmentId));

          // 3. Audit Log
          const userId = req.user?.id
            ? typeof req.user.id === "string"
              ? parseInt(req.user.id)
              : req.user.id
            : null;
          if (userId) {
            storage
              .createAuditLog({
                entityType: "attachment",
                entityId: attachmentId,
                action: "deleted",
                userId,
                description: `Deleted attachment: ${attachment.fileName}`,
              })
              .catch(console.error);
          }
        }

        res.status(204).send();
      } catch (error) {
        console.error("Error deleting attachment:", error);
        res.status(500).json({ message: "Failed to delete attachment" });
      }
    }
  );

  // 4. VIEW Attachment (inline display)
  app.get("/api/attachments/:id/view", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const attachment = await storage.getVoucherAttachmentById(parseInt(id));

      if (!attachment) {
        return res.status(404).json({ message: "Attachment not found" });
      }

      const fullPath = path.resolve(process.cwd(), attachment.filePath);

      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ message: "File missing from server" });
      }

      res.setHeader("Content-Type", attachment.fileType);
      // No Content-Disposition header for inline viewing

      const fileStream = fs.createReadStream(fullPath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("View error:", error);
      res.status(500).json({ message: "Failed to view file" });
    }
  });

  // 5. DOWNLOAD Attachment
  app.get(
    "/api/attachments/:id/download",
    isAuthenticated,
    async (req, res) => {
      try {
        const { id } = req.params;
        const attachment = await storage.getVoucherAttachmentById(parseInt(id));

        if (!attachment) {
          return res.status(404).json({ message: "Attachment not found" });
        }

        const fullPath = path.resolve(process.cwd(), attachment.filePath);

        if (!fs.existsSync(fullPath)) {
          return res.status(404).json({ message: "File missing from server" });
        }

        res.setHeader("Content-Type", attachment.fileType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${attachment.fileName}"`
        );

        const fileStream = fs.createReadStream(fullPath);
        fileStream.pipe(res);
      } catch (error) {
        console.error("Download error:", error);
        res.status(500).json({ message: "Failed to download file" });
      }
    }
  );

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
