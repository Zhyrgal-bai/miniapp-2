import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

function normalizeSignatureHeader(raw: string): string {
  return raw.replace(/^sha256=/i, "").trim();
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length === 0 || bb.length === 0 || ba.length !== bb.length) {
      return false;
    }
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function safeEqualUtf8(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Verify Finik webhook signature against raw request body.
 * Production: HMAC-SHA256(secret, rawBody) hex compared timing-safe.
 * Dev: allows plain secret match when FINIK_WEBHOOK_ALLOW_PLAIN=1.
 */
export function verifyFinikWebhookSignature(
  businessSecret: string | null,
  req: Request,
  rawBody: string,
): boolean {
  const headerName = (
    process.env.FINIK_WEBHOOK_SIGNATURE_HEADER || ""
  ).trim().toLowerCase();
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    if (!headerName) return false;
    if (!businessSecret?.trim()) return false;
  } else if (!headerName || !businessSecret?.trim()) {
    return true;
  }

  const sig = req.headers[headerName];
  const gotRaw = Array.isArray(sig) ? sig[0] : sig;
  if (typeof gotRaw !== "string" || !gotRaw.trim()) return false;

  const secret = businessSecret!.trim();
  const got = gotRaw.trim();
  const normalized = normalizeSignatureHeader(got);

  const hmacHex = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  if (safeEqualHex(hmacHex, normalized)) return true;
  if (safeEqualUtf8(got, hmacHex)) return true;
  if (safeEqualUtf8(got, `sha256=${hmacHex}`)) return true;

  if (
    !isProd &&
    (process.env.FINIK_WEBHOOK_ALLOW_PLAIN === "1" ||
      process.env.FINIK_WEBHOOK_ALLOW_PLAIN === "true")
  ) {
    return got === secret || got === `sha256=${secret}`;
  }

  return false;
}

/** In-process replay guard (paymentId + status + businessId). */
const replayCache = new Map<string, number>();
const REPLAY_TTL_MS =
  Number(process.env.FINIK_WEBHOOK_REPLAY_TTL_MS ?? 86_400_000) || 86_400_000;

export function isFinikWebhookReplay(
  businessId: number,
  paymentId: string,
  status: string,
): boolean {
  const key = `${businessId}:${paymentId}:${status}`;
  const now = Date.now();
  const exp = replayCache.get(key);
  if (exp != null && exp > now) return true;
  replayCache.set(key, now + REPLAY_TTL_MS);
  if (replayCache.size > 10_000) {
    for (const [k, v] of replayCache) {
      if (v <= now) replayCache.delete(k);
    }
  }
  return false;
}
