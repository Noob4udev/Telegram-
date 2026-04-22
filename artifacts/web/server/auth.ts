import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { db } from "./db";
import { users, verifyTokens, type User } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getBotUsername, isBotConfigured } from "./bot";

const ADMIN_TG_ID = (process.env.ADMIN_TELEGRAM_USER_ID || "").trim();

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export interface AuthRequest extends Request {
  user?: User;
}

export async function loadUser(req: AuthRequest, _res: Response, next: NextFunction) {
  if (req.session?.userId) {
    const rows = await db.select().from(users).where(eq(users.id, req.session.userId)).limit(1);
    if (rows.length > 0) req.user = rows[0];
  }
  next();
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: "Not signed in" });
  next();
}

export async function startVerify(_req: Request, res: Response) {
  if (!isBotConfigured()) {
    return res.status(500).json({ message: "Bot is not configured on the server." });
  }
  const token = randomUUID().replace(/-/g, "").slice(0, 24);
  await db.insert(verifyTokens).values({ token });
  const botUsername = getBotUsername();
  res.json({
    token,
    botUsername,
    deepLink: `https://t.me/${botUsername}?start=${token}`,
  });
}

export async function pollVerify(req: AuthRequest, res: Response) {
  const token = String(req.query.token || "");
  if (!token) return res.status(400).json({ message: "Missing token" });

  const rows = await db.select().from(verifyTokens).where(eq(verifyTokens.token, token)).limit(1);
  if (rows.length === 0) return res.status(404).json({ message: "Token not found" });

  const t = rows[0];
  if (!t.telegramUserId) return res.json({ pending: true });

  // Mark consumed (idempotent)
  if (!t.consumed) {
    await db.update(verifyTokens).set({ consumed: true }).where(eq(verifyTokens.token, token));
  }

  // Find or create user
  let userRow: User | undefined;
  const existing = await db.select().from(users).where(eq(users.telegramUserId, t.telegramUserId)).limit(1);
  if (existing.length > 0) {
    const [updated] = await db.update(users)
      .set({
        firstName: t.firstName ?? existing[0].firstName,
        lastName: t.lastName ?? existing[0].lastName,
        username: t.username ?? existing[0].username,
        isAdmin: ADMIN_TG_ID && existing[0].telegramUserId === ADMIN_TG_ID ? true : existing[0].isAdmin,
      })
      .where(eq(users.id, existing[0].id))
      .returning();
    userRow = updated;
  } else {
    const [created] = await db.insert(users).values({
      telegramUserId: t.telegramUserId,
      firstName: t.firstName,
      lastName: t.lastName,
      username: t.username,
      isAdmin: ADMIN_TG_ID && t.telegramUserId === ADMIN_TG_ID ? true : false,
    }).returning();
    userRow = created;
  }

  if (!userRow) return res.status(500).json({ message: "Failed to create user" });

  req.session!.userId = userRow.id;
  await new Promise<void>((resolve, reject) =>
    req.session!.save((err) => (err ? reject(err) : resolve()))
  );

  res.json({
    pending: false,
    user: serializeUser(userRow),
  });
}

export function logout(req: Request, res: Response) {
  req.session?.destroy(() => {
    res.clearCookie("teleguard.sid");
    res.json({ ok: true });
  });
}

export function me(req: AuthRequest, res: Response) {
  res.json({ user: req.user ? serializeUser(req.user) : null });
}

export function serializeUser(u: User) {
  return {
    id: u.id,
    telegramUserId: u.telegramUserId,
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username,
    isAdmin: u.isAdmin,
  };
}
