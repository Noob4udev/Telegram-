import type { Express } from "express";
import type { Server } from "http";
import { storage, type AccountScope } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { startSession, verifyCode, verifyPassword, DESKTOP_API_ID, DESKTOP_API_HASH } from "./session";
import {
  insertTelegramAccountSchema,
  insertReportSchema,
  insertReportTemplateSchema,
  sessionStartSchema,
  sessionVerifyCodeSchema,
  sessionVerifyPasswordSchema,
  sessionSaveSchema,
} from "@shared/schema";
import { requireAuth, startVerify, pollVerify, logout, me, type AuthRequest } from "./auth";
import { requireAdmin, runPush, getPushStatus } from "./admin-push";

function scopeOf(req: AuthRequest): AccountScope {
  return { userId: req.user!.id, isAdmin: req.user!.isAdmin };
}

const BLACKLISTED_USERNAMES = new Set([
  "FREE_ALL_INFO",
  "freetgnumbergroup",
  "RARE_API",
  "E_commerceseller",
  "proudkaamchor",
].map(u => u.toLowerCase()));

const activeJobs = new Set<number>();

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  failStaleInProgressReports().catch((err) =>
    console.error("Failed to clean up stale in-progress reports:", err),
  );

  // ----- Auth (no requireAuth) -----
  app.get(api.auth.me.path, me);
  app.post(api.auth.start.path, startVerify);
  app.get(api.auth.poll.path, pollVerify);
  app.post(api.auth.logout.path, logout);

  // ----- Admin: push monorepo to GitHub via the bundled script -----
  app.post("/tg-api/admin/push", requireAuth, requireAdmin, runPush);
  app.get("/tg-api/admin/push/status", requireAuth, requireAdmin, getPushStatus);

  // ----- Accounts (require auth) -----
  app.get(api.accounts.list.path, requireAuth, async (req: AuthRequest, res) => {
    res.json(await storage.getAccountsForScope(scopeOf(req)));
  });

  app.post(api.accounts.create.path, requireAuth, async (req: AuthRequest, res) => {
    try {
      const input = insertTelegramAccountSchema.parse(req.body);
      const account = await storage.createOrUpdateAccountForUser(req.user!.id, input);
      res.status(201).json(account);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  });

  app.delete(api.accounts.delete.path, requireAuth, async (req: AuthRequest, res) => {
    const ok = await storage.deleteAccountForUser(Number(req.params.id), scopeOf(req));
    if (!ok) return res.status(404).json({ message: "Account not found" });
    res.status(204).send();
  });

  // ----- Reports (require auth) -----
  app.get(api.reports.list.path, requireAuth, async (req: AuthRequest, res) => {
    res.json(await storage.getReportsForScope(scopeOf(req)));
  });

  app.post(api.reports.stop.path, requireAuth, async (req: AuthRequest, res) => {
    const reportId = Number(req.params.id);
    const report = await storage.getReport(reportId);
    if (!report) return res.status(404).json({ message: "Report not found" });
    if (!req.user!.isAdmin && report.userId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (report.status === "in_progress") {
      activeJobs.delete(reportId);
      await storage.updateReportStatus(reportId, "failed");
    }
    res.json(await storage.getReport(reportId));
  });

  app.post(api.reports.create.path, requireAuth, async (req: AuthRequest, res) => {
    try {
      const input = insertReportSchema.parse(req.body);

      // Blacklist check
      const cleanUsername = input.targetLink
        .replace(/^https?:\/\//, "")
        .replace(/^t\.me\//, "")
        .replace(/^@/, "")
        .split("/")
        .filter(Boolean)[0]
        ?.trim()
        ?.toLowerCase();

      if (cleanUsername && BLACKLISTED_USERNAMES.has(cleanUsername)) {
        return res.status(400).json({ message: "Reporting this target is not allowed." });
      }

      const scope = scopeOf(req);
      const accounts = (await storage.getAccountsForScope(scope)).filter((a) => a.status === "active");
      if (accounts.length === 0) {
        return res.status(400).json({ message: "No active Telegram accounts available for reporting" });
      }

      const report = await storage.createReportForUser(req.user!.id, input);

      setImmediate(() => {
        startReportJob(report.id, input.targetLink, input.reportType, input.reportCount, input.speed ?? "normal", scope)
          .catch((err) => console.error(`Background report job ${report.id} failed:`, err));
      });

      res.status(201).json(report);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  });

  // ----- Templates (shared, require auth) -----
  app.get(api.templates.list.path, requireAuth, async (_req, res) => {
    res.json(await storage.getTemplates());
  });

  app.post(api.templates.create.path, requireAuth, async (req, res) => {
    try {
      const input = insertReportTemplateSchema.parse(req.body);
      const template = await storage.createTemplate(input);
      res.status(201).json(template);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      throw err;
    }
  });

  app.post(api.templates.setDefault.path, requireAuth, async (req, res) => {
    res.json(await storage.setDefaultTemplate(Number(req.params.id)));
  });

  app.delete(api.templates.delete.path, requireAuth, async (req, res) => {
    await storage.deleteTemplate(Number(req.params.id));
    res.status(204).send();
  });

  // ----- Session String Generator (require auth) -----
  app.post(api.session.start.path, requireAuth, async (req, res) => {
    try {
      const input = sessionStartSchema.parse(req.body);
      res.json(await startSession(input.phoneNumber));
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("session.start failed:", err);
      res.status(400).json({ message: err?.errorMessage || err?.message || "Failed to start session" });
    }
  });

  app.post(api.session.verifyCode.path, requireAuth, async (req, res) => {
    try {
      const input = sessionVerifyCodeSchema.parse(req.body);
      res.json(await verifyCode(input.sessionId, input.code));
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("session.verifyCode failed:", err);
      res.status(400).json({ message: err?.errorMessage || err?.message || "Invalid code" });
    }
  });

  app.post(api.session.verifyPassword.path, requireAuth, async (req, res) => {
    try {
      const input = sessionVerifyPasswordSchema.parse(req.body);
      res.json(await verifyPassword(input.sessionId, input.password));
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("session.verifyPassword failed:", err);
      res.status(400).json({ message: err?.errorMessage || err?.message || "Incorrect password" });
    }
  });

  app.post(api.session.save.path, requireAuth, async (req: AuthRequest, res) => {
    try {
      const input = sessionSaveSchema.parse(req.body);
      const account = await storage.createOrUpdateAccountForUser(req.user!.id, {
        apiId: String(DESKTOP_API_ID),
        apiHash: DESKTOP_API_HASH,
        sessionString: input.sessionString,
        phoneNumber: input.phoneNumber,
      });
      res.status(201).json(account);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("session.save failed:", err);
      res.status(400).json({ message: err?.message || "Failed to save session" });
    }
  });

  return httpServer;
}

async function reportMessages(client: TelegramClient, {
  targetLink,
  messageIds,
  reportType = "spam",
  text = ""
}: {
  targetLink: string;
  messageIds: number[];
  reportType?: string;
  text?: string;
}) {
  if (!targetLink) throw new Error("targetLink required");

  function normalizeMessageIds(input: any) {
    return ([] as any[])
      .concat(input || [])
      .map(v => {
        if (typeof v === "number") return v;
        if (typeof v === "bigint") return Number(v);
        if (v && typeof v === "object") {
          if ("value" in (v as any) && (typeof (v as any).value === "number" || typeof (v as any).value === "bigint")) return Number((v as any).value);
          if ("id" in (v as any) && (v as any).id && typeof (v as any).id === "object" && "value" in (v as any).id) return Number((v as any).id.value);
        }
        if (typeof v === "string") {
          const n = Number((v as any).trim());
          return Number.isInteger(n) ? n : NaN;
        }
        return NaN;
      })
      .filter(v => Number.isInteger(v) && v > 0);
  }

  let entity: any;
  const cleanUsername = targetLink
    .replace("https://t.me/", "")
    .replace("t.me/", "")
    .replace("@", "")
    .split('/')
    .filter(Boolean)[0]
    ?.trim();

  if (!cleanUsername) throw new Error("Invalid target link");

  try {
    entity = await client.getEntity(cleanUsername);
  } catch (e: any) {
    console.error(`Failed to resolve entity for ${cleanUsername}:`, e);
    throw e;
  }

  if (!entity) throw new Error("Entity not found");

  const peer = await client.getInputEntity(entity);
  if (!peer) throw new Error("Could not create input peer");

  const ids = normalizeMessageIds(messageIds);

  const reasonMap: Record<string, () => any> = {
    "child abuse": () => new Api.InputReportReasonChildAbuse(),
    "child_abuse": () => new Api.InputReportReasonChildAbuse(),
    "copyright": () => new Api.InputReportReasonCopyright(),
    "fake": () => new Api.InputReportReasonFake(),
    "illegal drugs": () => new Api.InputReportReasonIllegalDrugs(),
    "illegal_drugs": () => new Api.InputReportReasonIllegalDrugs(),
    "personal details": () => new Api.InputReportReasonPersonalDetails(),
    "personal_details": () => new Api.InputReportReasonPersonalDetails(),
    "pornography": () => new Api.InputReportReasonPornography(),
    "spam": () => new Api.InputReportReasonSpam(),
    "violence": () => new Api.InputReportReasonViolence(),
    "scam": () => new (Api as any).InputReportReasonScam(),
  };

  const reason = reasonMap[reportType.toLowerCase()]?.() || new Api.InputReportReasonSpam();

  try {
    if (ids.length > 0) {
      const ReportModel = (Api.messages as any).ReportMessages || (Api.messages as any).Report;
      const result = await client.invoke(new ReportModel({
        peer,
        id: ids as any,
        reason,
        message: String(text || "Spam"),
        option: Buffer.alloc(0),
      }));
      return !!result;
    } else {
      const result = await client.invoke(new Api.account.ReportPeer({
        peer,
        reason,
        message: String(text || ""),
      }));
      return !!result;
    }
  } catch (err: any) {
    console.error("GramJS invoke error details:", { message: err.message, code: err.code, name: err.name });
    throw err;
  }
}

async function startReportJob(
  reportId: number,
  targetLink: string,
  reportType: string,
  totalCount: number,
  speed: string,
  scope: AccountScope,
) {
  try {
    activeJobs.add(reportId);
    await storage.updateReportStatus(reportId, "in_progress");

    const allAccounts = await storage.getAccountsForScope(scope);
    const accounts = allAccounts.filter(a => a.status === 'active');
    if (accounts.length === 0) throw new Error("No active accounts available for reporting");

    const defaultTemplate = await storage.getDefaultTemplate();
    const reportMessage = defaultTemplate?.content || "Report";

    const clients: Map<number, TelegramClient> = new Map();
    const cachedData: Map<number, { entity: any; msgIds: number[] }> = new Map();

    const getClient = async (account: any) => {
      if (clients.has(account.id)) return clients.get(account.id)!;
      const apiId = parseInt(account.apiId, 10);
      const apiHash = account.apiHash;
      const stringSession = new StringSession(account.sessionString);
      const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 3,
        useWSS: false,
        autoReconnect: false,
      });
      await client.connect();
      clients.set(account.id, client);
      return client;
    };

    const report = await storage.getReport(reportId);
    let successfulCount = report?.successfulCount || 0;
    let failedCount = report?.failedCount || 0;

    const runSingleReport = async (i: number) => {
      const account = accounts[i % accounts.length];
      const client = await getClient(account);
      let data = cachedData.get(account.id);

      if (!data) {
        let entity: any;
        let msgIds: number[] = [];
        const parts = targetLink.replace(/^https?:\/\//, '').split('/').filter(Boolean);
        const potentialId = parseInt(parts[parts.length - 1], 10);
        const isMessageLink = !isNaN(potentialId) && parts.length >= 3;

        if (isMessageLink) {
          const channelName = parts[parts.length - 2];
          entity = await client.getEntity(channelName);
          msgIds = [potentialId];
        } else {
          entity = await client.getEntity(targetLink);
          try {
            const history = await client.getMessages(entity, { limit: 10 });
            msgIds = history.map(m => m.id);
          } catch {}
        }
        data = { entity, msgIds };
        cachedData.set(account.id, data);
      }

      const result = await reportMessages(client, {
        targetLink, messageIds: data.msgIds, reportType, text: reportMessage,
      });
      return { success: !!result, accountApiId: account.apiId };
    };

    if (speed === "fast") {
      const BATCH_SIZE = 5;
      const start = successfulCount + failedCount;
      for (let batch = start; batch < totalCount; batch += BATCH_SIZE) {
        if (!activeJobs.has(reportId)) break;
        const batchIndices = Array.from(
          { length: Math.min(BATCH_SIZE, totalCount - batch) },
          (_, k) => batch + k
        );
        const batchResults = await Promise.allSettled(batchIndices.map(i => runSingleReport(i)));
        for (const result of batchResults) {
          if (result.status === "fulfilled" && result.value.success) successfulCount++;
          else { failedCount++; if (result.status === "rejected") console.error("Batch report failed:", result.reason); }
        }
        await storage.updateReportCounts(reportId, successfulCount, failedCount);
        if (batch + BATCH_SIZE < totalCount) await new Promise(r => setTimeout(r, 500));
      }
    } else {
      for (let i = successfulCount + failedCount; i < totalCount; i++) {
        if (!activeJobs.has(reportId)) break;
        try {
          const result = await runSingleReport(i);
          if (result.success) successfulCount++; else failedCount++;
          await storage.updateReportCounts(reportId, successfulCount, failedCount);
          await new Promise(r => setTimeout(r, 2000));
        } catch (e: any) {
          console.error(`Error on report ${i + 1}:`, e);
          failedCount++;
          await storage.updateReportCounts(reportId, successfulCount, failedCount);
        }
      }
    }

    for (const client of Array.from(clients.values())) await client.disconnect();

    // If it was cancelled, status was already set to 'failed' by the /stop endpoint
    if (activeJobs.has(reportId)) {
      await storage.updateReportStatus(reportId, successfulCount > 0 ? "completed" : "failed");
      activeJobs.delete(reportId);
    }
  } catch (error: any) {
    activeJobs.delete(reportId);
    console.error("Reporting failed completely:", error);
    await storage.updateReportStatus(reportId, "failed");
  }
}

async function failStaleInProgressReports() {
  const inProgress = await storage.getInProgressReports();
  for (const report of inProgress) {
    console.log(`Marking stale report ${report.id} as failed (server restarted)`);
    await storage.updateReportStatus(report.id, "failed");
  }
}
