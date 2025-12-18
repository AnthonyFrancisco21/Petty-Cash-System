import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  decimal,
  integer,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User roles
export type UserRole = "cash_manager" | "requester" | "approver" | "admin";

// Users table with role-based access
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { length: 50 }).notNull().default("requester"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  requestedVouchers: many(vouchers, { relationName: "requester" }),
  approvedVouchers: many(vouchers, { relationName: "approver" }),
}));

// Chart of Accounts
export const chartOfAccounts = pgTable("chart_of_accounts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chartOfAccountsRelations = relations(chartOfAccounts, ({ many }) => ({
  vouchers: many(vouchers),
}));

// Petty Cash Fund configuration
export const pettyCashFund = pgTable("petty_cash_fund", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  imprestAmount: decimal("imprest_amount", { precision: 15, scale: 2 }).notNull(),
  currentBalance: decimal("current_balance", { precision: 15, scale: 2 }).notNull(),
  managerId: varchar("manager_id").references(() => users.id),
  lastReplenishmentDate: timestamp("last_replenishment_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Voucher status
export type VoucherStatus = "pending" | "approved" | "rejected" | "replenished";

// Petty Cash Vouchers
export const vouchers = pgTable("vouchers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  voucherNumber: varchar("voucher_number", { length: 50 }).notNull().unique(),
  date: timestamp("date").notNull(),
  payee: varchar("payee", { length: 255 }).notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  invoiceNumber: varchar("invoice_number", { length: 100 }),
  amountNetOfVat: decimal("amount_net_of_vat", { precision: 15, scale: 2 }),
  vatAmount: decimal("vat_amount", { precision: 15, scale: 2 }),
  amountWithheld: decimal("amount_withheld", { precision: 15, scale: 2 }),
  chartOfAccountId: integer("chart_of_account_id").references(() => chartOfAccounts.id),
  requestedById: varchar("requested_by_id").references(() => users.id),
  approvedById: varchar("approved_by_id").references(() => users.id),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  supportingDocsSubmitted: timestamp("supporting_docs_submitted"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vouchersRelations = relations(vouchers, ({ one }) => ({
  requester: one(users, {
    fields: [vouchers.requestedById],
    references: [users.id],
    relationName: "requester",
  }),
  approver: one(users, {
    fields: [vouchers.approvedById],
    references: [users.id],
    relationName: "approver",
  }),
  chartOfAccount: one(chartOfAccounts, {
    fields: [vouchers.chartOfAccountId],
    references: [chartOfAccounts.id],
  }),
}));

// Replenishment Requests
export const replenishmentRequests = pgTable("replenishment_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  requestDate: timestamp("request_date").notNull().defaultNow(),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  totalVat: decimal("total_vat", { precision: 15, scale: 2 }).notNull(),
  totalWithheld: decimal("total_withheld", { precision: 15, scale: 2 }).notNull(),
  totalNetAmount: decimal("total_net_amount", { precision: 15, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  requestedById: varchar("requested_by_id").references(() => users.id),
  approvedById: varchar("approved_by_id").references(() => users.id),
  voucherIds: integer("voucher_ids").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit Log for tracking all changes
export const auditLogs = pgTable("audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  entityType: varchar("entity_type", { length: 50 }).notNull(), // 'voucher', 'fund', 'user', etc.
  entityId: varchar("entity_id", { length: 100 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(), // 'created', 'updated', 'approved', 'rejected', etc.
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  userId: varchar("user_id").references(() => users.id),
  ipAddress: varchar("ip_address", { length: 50 }),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  description: text("description"),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// Budget tracking per chart of account
export const accountBudgets = pgTable("account_budgets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  chartOfAccountId: integer("chart_of_account_id").notNull().references(() => chartOfAccounts.id),
  budgetAmount: decimal("budget_amount", { precision: 15, scale: 2 }).notNull(),
  period: varchar("period", { length: 20 }).notNull(), // 'monthly', 'quarterly', 'yearly'
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  alertThreshold: decimal("alert_threshold", { precision: 5, scale: 2 }).default("80"), // percentage
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const accountBudgetsRelations = relations(accountBudgets, ({ one }) => ({
  chartOfAccount: one(chartOfAccounts, {
    fields: [accountBudgets.chartOfAccountId],
    references: [chartOfAccounts.id],
  }),
}));

// Document attachments for vouchers
export const voucherAttachments = pgTable("voucher_attachments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  voucherId: integer("voucher_id").notNull().references(() => vouchers.id),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileType: varchar("file_type", { length: 100 }).notNull(),
  fileSize: integer("file_size").notNull(),
  fileData: text("file_data").notNull(), // base64 encoded
  uploadedById: varchar("uploaded_by_id").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const voucherAttachmentsRelations = relations(voucherAttachments, ({ one }) => ({
  voucher: one(vouchers, {
    fields: [voucherAttachments.voucherId],
    references: [vouchers.id],
  }),
  uploadedBy: one(users, {
    fields: [voucherAttachments.uploadedById],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertChartOfAccountSchema = createInsertSchema(chartOfAccounts).omit({
  id: true,
  createdAt: true,
});

export const insertVoucherSchema = createInsertSchema(vouchers).omit({
  id: true,
  voucherNumber: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPettyCashFundSchema = createInsertSchema(pettyCashFund).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReplenishmentRequestSchema = createInsertSchema(replenishmentRequests).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export const insertAccountBudgetSchema = createInsertSchema(accountBudgets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVoucherAttachmentSchema = createInsertSchema(voucherAttachments).omit({
  id: true,
  uploadedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type ChartOfAccount = typeof chartOfAccounts.$inferSelect;
export type InsertChartOfAccount = z.infer<typeof insertChartOfAccountSchema>;
export type Voucher = typeof vouchers.$inferSelect;
export type InsertVoucher = z.infer<typeof insertVoucherSchema>;
export type PettyCashFund = typeof pettyCashFund.$inferSelect;
export type InsertPettyCashFund = z.infer<typeof insertPettyCashFundSchema>;
export type ReplenishmentRequest = typeof replenishmentRequests.$inferSelect;
export type InsertReplenishmentRequest = z.infer<typeof insertReplenishmentRequestSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AccountBudget = typeof accountBudgets.$inferSelect;
export type InsertAccountBudget = z.infer<typeof insertAccountBudgetSchema>;
export type VoucherAttachment = typeof voucherAttachments.$inferSelect;
export type InsertVoucherAttachment = z.infer<typeof insertVoucherAttachmentSchema>;

// Extended types with relations
export type VoucherWithRelations = Voucher & {
  requester?: User | null;
  approver?: User | null;
  chartOfAccount?: ChartOfAccount | null;
};

export type AuditLogWithUser = AuditLog & {
  user?: User | null;
};

export type AccountBudgetWithAccount = AccountBudget & {
  chartOfAccount?: ChartOfAccount | null;
};
