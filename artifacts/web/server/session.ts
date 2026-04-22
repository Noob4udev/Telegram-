import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { computeCheck } from "telegram/Password";
import { randomUUID } from "crypto";

// Telegram Desktop's official api credentials
export const DESKTOP_API_ID = 2040;
export const DESKTOP_API_HASH = "b18441a1ff607e10a989891a5462e627";

interface PendingSession {
  client: TelegramClient;
  phoneNumber: string;
  phoneCodeHash: string;
  createdAt: number;
}

const pending = new Map<string, PendingSession>();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

function gc() {
  const now = Date.now();
  for (const [id, p] of pending) {
    if (now - p.createdAt > TTL_MS) {
      try { p.client.disconnect(); } catch {}
      pending.delete(id);
    }
  }
}
setInterval(gc, 60 * 1000).unref?.();

async function newClient(): Promise<TelegramClient> {
  const session = new StringSession("");
  const client = new TelegramClient(session, DESKTOP_API_ID, DESKTOP_API_HASH, {
    connectionRetries: 3,
    useWSS: false,
    deviceModel: "Desktop",
    systemVersion: "Windows 10",
    appVersion: "5.0.0",
    langCode: "en",
    systemLangCode: "en",
  });
  await client.connect();
  return client;
}

export async function startSession(phoneNumber: string) {
  const phone = phoneNumber.trim();
  const client = await newClient();
  let phoneCodeHash = "";
  let codeType = "unknown";
  try {
    const result: any = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber: phone,
        apiId: DESKTOP_API_ID,
        apiHash: DESKTOP_API_HASH,
        // Telegram Desktop sends empty CodeSettings.
        settings: new Api.CodeSettings({}),
      })
    );
    phoneCodeHash = result.phoneCodeHash;
    codeType = result?.type?.className || "unknown";
    console.log(`[session] SendCode ok phone=${phone} type=${codeType} nextType=${result?.nextType?.className || "none"} timeout=${result?.timeout}`);
  } catch (e: any) {
    try { await client.disconnect(); } catch {}
    console.error(`[session] SendCode failed phone=${phone}`, {
      errorMessage: e?.errorMessage,
      message: e?.message,
      code: e?.code,
    });
    throw e;
  }

  const sessionId = randomUUID();
  pending.set(sessionId, {
    client,
    phoneNumber: phone,
    phoneCodeHash,
    createdAt: Date.now(),
  });
  return { sessionId, codeType };
}

export async function verifyCode(sessionId: string, code: string) {
  const p = pending.get(sessionId);
  if (!p) throw new Error("Session expired or not found. Please start over.");
  try {
    await p.client.invoke(
      new Api.auth.SignIn({
        phoneNumber: p.phoneNumber,
        phoneCodeHash: p.phoneCodeHash,
        phoneCode: code,
      })
    );
  } catch (e: any) {
    if (e?.errorMessage === "SESSION_PASSWORD_NEEDED" || e?.className === "SessionPasswordNeededError") {
      return { needs2FA: true as const };
    }
    throw e;
  }
  const sessionString = (p.client.session as StringSession).save() as unknown as string;
  await cleanup(sessionId);
  return { needs2FA: false as const, sessionString, phoneNumber: p.phoneNumber };
}

export async function verifyPassword(sessionId: string, password: string) {
  const p = pending.get(sessionId);
  if (!p) throw new Error("Session expired or not found. Please start over.");
  const pwd: any = await p.client.invoke(new Api.account.GetPassword());
  const srpCheck = await computeCheck(pwd, password);
  await p.client.invoke(new Api.auth.CheckPassword({ password: srpCheck }));
  const sessionString = (p.client.session as StringSession).save() as unknown as string;
  await cleanup(sessionId);
  return { sessionString, phoneNumber: p.phoneNumber };
}

async function cleanup(sessionId: string) {
  const p = pending.get(sessionId);
  if (!p) return;
  try { await p.client.disconnect(); } catch {}
  pending.delete(sessionId);
}

export async function cancelSession(sessionId: string) {
  await cleanup(sessionId);
}
