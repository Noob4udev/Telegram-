import { pgTable, text, serial, integer, timestamp, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramUserId: text("telegram_user_id").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  username: text("username"),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const verifyTokens = pgTable("verify_tokens", {
  token: text("token").primaryKey(),
  telegramUserId: text("telegram_user_id"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  username: text("username"),
  consumed: boolean("consumed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const telegramAccounts = pgTable("telegram_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  apiId: text("api_id").notNull(),
  apiHash: text("api_hash").notNull(),
  sessionString: text("session_string").notNull(),
  phoneNumber: text("phone_number"),
  status: text("status").default('active'),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  unq: uniqueIndex("api_credentials_phone_unq").on(t.apiId, t.apiHash, t.phoneNumber),
}));

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  targetLink: text("target_link").notNull(),
  reportType: text("report_type").notNull(),
  reportCount: integer("report_count").notNull(),
  successfulCount: integer("successful_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  status: text("status").notNull().default("pending"),
  speed: text("speed").notNull().default("normal"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reportTemplates = pgTable("report_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTelegramAccountSchema = createInsertSchema(telegramAccounts).omit({ id: true, createdAt: true, status: true, userId: true });
export const insertReportSchema = createInsertSchema(reports).omit({ id: true, createdAt: true, status: true, userId: true });
export const insertReportTemplateSchema = createInsertSchema(reportTemplates).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type VerifyToken = typeof verifyTokens.$inferSelect;

export type TelegramAccount = typeof telegramAccounts.$inferSelect;
export type InsertTelegramAccount = z.infer<typeof insertTelegramAccountSchema>;

export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;

export type ReportTemplate = typeof reportTemplates.$inferSelect;
export type InsertReportTemplate = z.infer<typeof insertReportTemplateSchema>;

export const sessionStartSchema = z.object({
  phoneNumber: z.string().min(5, "Phone number is required"),
});
export const sessionVerifyCodeSchema = z.object({
  sessionId: z.string().min(1),
  code: z.string().min(1),
});
export const sessionVerifyPasswordSchema = z.object({
  sessionId: z.string().min(1),
  password: z.string().min(1),
});
export const sessionSaveSchema = z.object({
  sessionString: z.string().min(1),
  phoneNumber: z.string().min(1),
});

export type MeResponse = {
  user: {
    id: number;
    telegramUserId: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    isAdmin: boolean;
  } | null;
};
