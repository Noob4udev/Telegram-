import { db } from "./db";
import {
  telegramAccounts,
  reports,
  reportTemplates,
  type TelegramAccount,
  type InsertTelegramAccount,
  type Report,
  type InsertReport,
  type ReportTemplate,
  type InsertReportTemplate
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export interface AccountScope {
  userId: number;
  isAdmin: boolean;
}

export class DatabaseStorage {
  async getAccountsForScope(scope: AccountScope): Promise<TelegramAccount[]> {
    if (scope.isAdmin) {
      return await db.select().from(telegramAccounts);
    }
    return await db.select().from(telegramAccounts).where(eq(telegramAccounts.userId, scope.userId));
  }

  async getAccountById(id: number): Promise<TelegramAccount | undefined> {
    const [row] = await db.select().from(telegramAccounts).where(eq(telegramAccounts.id, id)).limit(1);
    return row;
  }

  async createOrUpdateAccountForUser(
    userId: number,
    account: InsertTelegramAccount,
  ): Promise<TelegramAccount> {
    const phone = account.phoneNumber ?? null;

    const existing = await db.select().from(telegramAccounts).where(
      and(
        eq(telegramAccounts.apiId, account.apiId),
        eq(telegramAccounts.apiHash, account.apiHash),
        phone === null
          ? sql`${telegramAccounts.phoneNumber} is null`
          : eq(telegramAccounts.phoneNumber, phone),
      )
    ).limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(telegramAccounts)
        .set({ sessionString: account.sessionString, phoneNumber: phone, userId })
        .where(eq(telegramAccounts.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(telegramAccounts)
      .values({ ...account, phoneNumber: phone, userId })
      .returning();
    return created;
  }

  async deleteAccountForUser(id: number, scope: AccountScope): Promise<boolean> {
    const acc = await this.getAccountById(id);
    if (!acc) return false;
    if (!scope.isAdmin && acc.userId !== scope.userId) return false;
    await db.delete(telegramAccounts).where(eq(telegramAccounts.id, id));
    return true;
  }

  async getReportsForScope(scope: AccountScope): Promise<Report[]> {
    if (scope.isAdmin) {
      return await db.select().from(reports).orderBy(desc(reports.createdAt));
    }
    return await db.select().from(reports)
      .where(eq(reports.userId, scope.userId))
      .orderBy(desc(reports.createdAt));
  }

  async getReport(id: number): Promise<Report | undefined> {
    const [report] = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
    return report;
  }

  async createReportForUser(userId: number, report: InsertReport): Promise<Report> {
    const [created] = await db.insert(reports).values({ ...report, userId }).returning();
    return created;
  }

  async updateReportStatus(id: number, status: string): Promise<void> {
    await db.update(reports).set({ status }).where(eq(reports.id, id));
  }

  async updateReportCounts(id: number, successfulCount: number, failedCount: number): Promise<void> {
    await db.update(reports).set({ successfulCount, failedCount }).where(eq(reports.id, id));
  }

  async getTemplates(): Promise<ReportTemplate[]> {
    return await db.select().from(reportTemplates).orderBy(desc(reportTemplates.createdAt));
  }

  async getDefaultTemplate(): Promise<ReportTemplate | undefined> {
    const [template] = await db.select().from(reportTemplates).where(eq(reportTemplates.isDefault, true)).limit(1);
    return template;
  }

  async createTemplate(template: InsertReportTemplate): Promise<ReportTemplate> {
    if (template.isDefault) {
      await db.update(reportTemplates).set({ isDefault: false });
    }
    const [created] = await db.insert(reportTemplates).values(template).returning();
    return created;
  }

  async setDefaultTemplate(id: number): Promise<ReportTemplate> {
    await db.update(reportTemplates).set({ isDefault: false });
    const [updated] = await db.update(reportTemplates).set({ isDefault: true }).where(eq(reportTemplates.id, id)).returning();
    return updated;
  }

  async deleteTemplate(id: number): Promise<void> {
    await db.delete(reportTemplates).where(eq(reportTemplates.id, id));
  }

  // Used by all stale-report cleanup at boot
  async getInProgressReports(): Promise<Report[]> {
    return await db.select().from(reports).where(eq(reports.status, "in_progress"));
  }
}

export const storage = new DatabaseStorage();
