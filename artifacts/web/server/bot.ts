import { db } from "./db";
import { verifyTokens } from "@shared/schema";
import { eq } from "drizzle-orm";

const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const BOT_USERNAME = (process.env.TELEGRAM_BOT_USERNAME || "").trim().replace(/^@/, "").trim();

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

let polling = false;
let lastUpdateId = 0;

export function getBotUsername() {
  return BOT_USERNAME;
}

export function isBotConfigured() {
  return !!BOT_TOKEN && !!BOT_USERNAME;
}

async function tg(method: string, body?: any): Promise<any> {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function sendMessage(chatId: number | string, text: string) {
  try {
    await tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
  } catch (e) {
    console.error("bot sendMessage failed:", e);
  }
}

async function handleStart(chatId: number, from: any, token: string | undefined) {
  if (!token) {
    await sendMessage(
      chatId,
      "👋 Hi! To log in to TeleGuard, click the <b>Verify with Telegram</b> button on the website."
    );
    return;
  }

  const rows = await db.select().from(verifyTokens).where(eq(verifyTokens.token, token)).limit(1);
  if (rows.length === 0) {
    await sendMessage(chatId, "❌ This verify link is invalid or has expired. Please go back to the website and try again.");
    return;
  }
  if (rows[0].consumed) {
    await sendMessage(chatId, "ℹ️ This verify link has already been used. Please go back to the website and start a new verification.");
    return;
  }

  await db.update(verifyTokens)
    .set({
      telegramUserId: String(from.id),
      firstName: from.first_name ?? null,
      lastName: from.last_name ?? null,
      username: from.username ?? null,
    })
    .where(eq(verifyTokens.token, token));

  await sendMessage(
    chatId,
    `✅ Verified, ${from.first_name || from.username || "friend"}!\n\nYou can return to the website now — it should log you in automatically.`
  );
}

async function processUpdate(update: any) {
  try {
    const msg = update.message;
    if (!msg) return;
    const chatId = msg.chat?.id;
    const from = msg.from;
    if (!chatId || !from) return;

    const text: string = msg.text || "";
    if (text.startsWith("/start")) {
      const parts = text.split(/\s+/);
      const param = parts[1];
      await handleStart(chatId, from, param);
    } else if (text.startsWith("/help")) {
      await sendMessage(chatId, "Use the <b>Verify with Telegram</b> button on the TeleGuard website to log in.");
    }
  } catch (e) {
    console.error("bot processUpdate error:", e);
  }
}

export function startBot() {
  if (!isBotConfigured()) {
    console.warn("[bot] TELEGRAM_BOT_TOKEN / TELEGRAM_BOT_USERNAME not set — bot disabled.");
    return;
  }
  if (polling) return;
  polling = true;
  console.log(`[bot] Starting Telegram bot poller for @${BOT_USERNAME}`);

  // Drop any pending updates from previous runs
  (async () => {
    try {
      const r = await tg("getUpdates", { offset: -1, timeout: 0 });
      if (r?.result?.length) lastUpdateId = r.result[r.result.length - 1].update_id;
    } catch {}
    pollLoop();
  })();
}

async function pollLoop() {
  while (polling) {
    try {
      const r = await tg("getUpdates", {
        offset: lastUpdateId + 1,
        timeout: 30,
        allowed_updates: ["message"],
      });
      if (r?.ok && Array.isArray(r.result)) {
        for (const upd of r.result) {
          lastUpdateId = Math.max(lastUpdateId, upd.update_id);
          await processUpdate(upd);
        }
      } else if (r && !r.ok) {
        console.error("[bot] getUpdates error:", r);
        await new Promise((res) => setTimeout(res, 3000));
      }
    } catch (e) {
      console.error("[bot] poll error:", e);
      await new Promise((res) => setTimeout(res, 3000));
    }
  }
}
