/**
 * Защита HTTP-вебхуков Telegram: secret header, лимиты, базовая валидация Update.
 * Токены и тела апдейтов в логи не попадают.
 */
import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Telegram при указанном setWebhook(secret_token) шлёт заголовок
 * `X-Telegram-Bot-Api-Secret-Token`; Express отдаёт его в нижнем регистре.
 */

const WEBHOOK_SLUG_HEX = /^[a-f0-9]{32}$/;

function readExpectedWebhookSecret(): string | undefined {
  const s = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  return s !== "" ? s : undefined;
}

function isProdLike(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const r = process.env.RENDER;
  return typeof r === "string" && r.trim() !== "";
}

function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function getClientIpForWebhook(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim() !== "") {
    return xff.split(",")[0]!.trim();
  }
  if (Array.isArray(xff) && xff[0]) {
    return String(xff[0]).trim();
  }
  return req.socket?.remoteAddress ?? "unknown";
}

const maxRpsDefault = 80;
function maxRpsPerIp(): number {
  const raw = process.env.TELEGRAM_WEBHOOK_MAX_RPS_PER_IP?.trim();
  if (!raw) return maxRpsDefault;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 && n <= 500 ? Math.trunc(n) : maxRpsDefault;
}

type Bucket = { windowStart: number; count: number };
const rateBuckets = new Map<string, Bucket>();
const RATE_WINDOW_MS = 1000;
let ratePruneCounter = 0;

function allowRate(ip: string): boolean {
  const max = maxRpsPerIp();
  const now = Date.now();
  const b = rateBuckets.get(ip);
  if (!b || now - b.windowStart >= RATE_WINDOW_MS) {
    rateBuckets.set(ip, { windowStart: now, count: 1 });
  } else if (b.count >= max) {
    return false;
  } else {
    b.count += 1;
  }
  if (++ratePruneCounter % 500 === 0) {
    const cutoff = now - RATE_WINDOW_MS * 3;
    for (const [k, v] of rateBuckets) {
      if (v.windowStart < cutoff) rateBuckets.delete(k);
    }
  }
  return true;
}

/**
 * Возвращает текст причины отклонения или null, если тело похоже на Telegram Update.
 * Не логирует содержимое body.
 */
export function validateTelegramUpdatePayload(body: unknown): string | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return "not_object";
  }
  const u = body as Record<string, unknown>;
  const uid = u.update_id;
  if (typeof uid !== "number" || !Number.isInteger(uid) || uid < 0) {
    return "bad_update_id";
  }
  const keysAside = Object.keys(u).filter((k) => k !== "update_id");
  const hasPayload = keysAside.some((k) => {
    const v = u[k];
    return v != null && typeof v === "object" && !Array.isArray(v);
  });
  if (!hasPayload) {
    return "no_update_payload";
  }
  const msg = u.message;
  if (msg != null) {
    if (typeof msg !== "object" || Array.isArray(msg)) return "bad_message";
    const m = msg as Record<string, unknown>;
    if (m.chat != null) {
      if (typeof m.chat !== "object" || Array.isArray(m.chat)) return "bad_message_chat";
    }
  }
  return null;
}

/**
 * Express middleware: rate limit, secret header (если задан в env), валидация JSON update.
 */
export function telegramWebhookGate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const ip = getClientIpForWebhook(req);
  if (!allowRate(ip)) {
    res.sendStatus(429);
    return;
  }

  const expected = readExpectedWebhookSecret();
  if (isProdLike() && !expected) {
    console.error(
      "[webhook] TELEGRAM_WEBHOOK_SECRET is required in production (RENDER / NODE_ENV)",
    );
    res.sendStatus(503);
    return;
  }

  if (expected) {
    const gotRaw = req.get("X-Telegram-Bot-Api-Secret-Token");
    const got = typeof gotRaw === "string" ? gotRaw.trim() : "";
    if (!got || !constantTimeEqual(got, expected)) {
      res.sendStatus(403);
      return;
    }
  }

  const why = validateTelegramUpdatePayload(req.body);
  if (why) {
    console.error("[webhook] invalid update payload:", why);
    res.sendStatus(400);
    return;
  }

  next();
}

export function isHexWebhookSlug(slug: string): boolean {
  return WEBHOOK_SLUG_HEX.test(slug);
}

export function legacyNumericWebhookPathEnabled(): boolean {
  return process.env.TELEGRAM_WEBHOOK_LEGACY_NUMERIC_PATH === "1";
}

/** Вызов setWebhook с секретом (если задан TELEGRAM_WEBHOOK_SECRET). */
export async function telegramSetWebhookOnApi(
  api: { setWebhook: (url: string, extra?: object) => Promise<unknown> },
  url: string,
): Promise<void> {
  const secret = readExpectedWebhookSecret();
  if (secret) {
    await api.setWebhook(url, { secret_token: secret });
  } else {
    await api.setWebhook(url);
  }
}
