import crypto from "node:crypto";
import { logAuthReject } from "../server/structuredLog.js";

const DEFAULT_MAX_AGE_SEC = 86_400;

function maxAgeSec(): number {
  const raw = process.env.TELEGRAM_INITDATA_MAX_AGE_SEC?.trim();
  if (raw === "" || raw == null) return DEFAULT_MAX_AGE_SEC;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 60) return DEFAULT_MAX_AGE_SEC;
  return Math.floor(n);
}

/** Parse auth_date unix seconds from initData query string. */
export function parseInitDataAuthDate(initData: string): number | null {
  const raw = initData.trim();
  if (raw === "") return null;
  try {
    const v = new URLSearchParams(raw).get("auth_date")?.trim() ?? "";
    if (!/^\d+$/.test(v)) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  } catch {
    return null;
  }
}

export type InitDataPolicyRejectReason =
  | "expired_initdata"
  | "invalid_auth_date"
  | "replay";

export type InitDataPolicyResult =
  | { ok: true }
  | { ok: false; reason: InitDataPolicyRejectReason };

function replayGuardEnabled(): boolean {
  const v = process.env.TELEGRAM_INITDATA_REPLAY_GUARD?.trim();
  return v === "1" || v === "true" || v === "on";
}

const replayCache = new Map<string, number>();
const REPLAY_TTL_MS = 120_000;

function pruneReplayCache(now: number): void {
  if (replayCache.size < 5000) return;
  for (const [k, exp] of replayCache) {
    if (exp <= now) replayCache.delete(k);
  }
}

function checkReplay(initData: string): InitDataPolicyResult {
  if (!replayGuardEnabled()) return { ok: true };
  const now = Date.now();
  pruneReplayCache(now);
  const key = crypto.createHash("sha256").update(initData).digest("hex");
  const exp = replayCache.get(key);
  if (exp != null && exp > now) {
    return { ok: false, reason: "replay" };
  }
  replayCache.set(key, now + REPLAY_TTL_MS);
  return { ok: true };
}

/** Freshness + optional replay after HMAC validation succeeded. */
export function validateInitDataPolicy(initData: string): InitDataPolicyResult {
  const authDate = parseInitDataAuthDate(initData);
  if (authDate == null) {
    return { ok: false, reason: "invalid_auth_date" };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const maxAge = maxAgeSec();
  if (nowSec - authDate > maxAge) {
    return { ok: false, reason: "expired_initdata" };
  }
  if (authDate > nowSec + 120) {
    return { ok: false, reason: "invalid_auth_date" };
  }
  return checkReplay(initData);
}

export function logInitDataPolicyReject(
  path: string,
  method: string,
  reason: InitDataPolicyRejectReason,
): void {
  logAuthReject({ path, reason });
}
