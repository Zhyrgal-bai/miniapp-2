import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db.js";

export const OPERATOR_SESSION_HEADER = "x-operator-session";
const MINUTE_MS = 60_000;

type OperatorSessionRow = {
  id: number;
  operatorTelegramId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  lastReauthAt: Date | null;
};

function ttlMinutes(): number {
  const raw = Number(process.env.OPERATOR_SESSION_TTL_MIN ?? "20");
  if (!Number.isFinite(raw)) return 20;
  return Math.min(30, Math.max(15, Math.floor(raw)));
}

function reauthWindowMinutes(): number {
  const raw = Number(process.env.OPERATOR_REAUTH_WINDOW_MIN ?? "5");
  if (!Number.isFinite(raw)) return 5;
  return Math.min(30, Math.max(1, Math.floor(raw)));
}

export function operatorPasswordHashFromEnv(): string {
  const hash = String(process.env.OPERATOR_PASSWORD_HASH ?? "").trim();
  return hash;
}

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function expiresAtFromNow(nowMs: number): Date {
  return new Date(nowMs + ttlMinutes() * MINUTE_MS);
}

export async function verifyOperatorPassword(password: string): Promise<boolean> {
  const hash = operatorPasswordHashFromEnv();
  if (hash === "") return false;
  if (!hash.startsWith("$2")) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export type OperatorUnlockResult =
  | { ok: true; token: string; expiresAt: string }
  | { ok: false; status: 401 | 500; code: string; message: string };

export async function unlockOperatorSession(input: {
  operatorTelegramId: string;
  password: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<OperatorUnlockResult> {
  const configured = operatorPasswordHashFromEnv();
  if (configured === "") {
    return {
      ok: false,
      status: 500,
      code: "operator_password_not_configured",
      message: "Operator password is not configured",
    };
  }
  const ok = await verifyOperatorPassword(input.password);
  if (!ok) {
    return {
      ok: false,
      status: 401,
      code: "operator_unlock_failed",
      message: "Неверный пароль оператора",
    };
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const nowMs = Date.now();
  const tokenHash = sha256Hex(token);
  await prisma.platformOperatorSession.create({
    data: {
      operatorTelegramId: input.operatorTelegramId,
      tokenHash,
      userAgent:
        typeof input.userAgent === "string" && input.userAgent.trim() !== ""
          ? input.userAgent.trim().slice(0, 512)
          : null,
      ipHash:
        typeof input.ip === "string" && input.ip.trim() !== ""
          ? sha256Hex(input.ip.trim())
          : null,
      expiresAt: expiresAtFromNow(nowMs),
      lastActivityAt: new Date(nowMs),
      lastReauthAt: new Date(nowMs),
      revokedAt: null,
    },
  });

  return {
    ok: true,
    token,
    expiresAt: expiresAtFromNow(nowMs).toISOString(),
  };
}

async function resolveLiveSession(input: {
  operatorTelegramId: string;
  token: string;
}): Promise<OperatorSessionRow | null> {
  const tokenHash = sha256Hex(input.token);
  const row = await prisma.platformOperatorSession.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      operatorTelegramId: true,
      expiresAt: true,
      revokedAt: true,
      lastReauthAt: true,
    },
  });
  if (!row) return null;
  if (row.operatorTelegramId !== input.operatorTelegramId) return null;
  if (row.revokedAt != null) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    await prisma.platformOperatorSession.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
    return null;
  }
  return row;
}

export async function validateOperatorSession(input: {
  operatorTelegramId: string;
  token: string;
}): Promise<{ ok: true; sessionId: number; expiresAt: string } | { ok: false }> {
  const row = await resolveLiveSession(input);
  if (!row) return { ok: false };
  const nowMs = Date.now();
  const nextExpires = expiresAtFromNow(nowMs);
  await prisma.platformOperatorSession.update({
    where: { id: row.id },
    data: {
      lastActivityAt: new Date(nowMs),
      expiresAt: nextExpires,
    },
  });
  return { ok: true, sessionId: row.id, expiresAt: nextExpires.toISOString() };
}

export async function revokeOperatorSession(input: {
  operatorTelegramId: string;
  token: string;
}): Promise<void> {
  const tokenHash = sha256Hex(input.token);
  await prisma.platformOperatorSession.updateMany({
    where: {
      operatorTelegramId: input.operatorTelegramId,
      tokenHash,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}

export async function markOperatorSessionReauth(input: {
  operatorTelegramId: string;
  token: string;
}): Promise<boolean> {
  const row = await resolveLiveSession(input);
  if (!row) return false;
  await prisma.platformOperatorSession.update({
    where: { id: row.id },
    data: { lastReauthAt: new Date() },
  });
  return true;
}

export async function hasRecentOperatorReauth(input: {
  operatorTelegramId: string;
  token: string;
}): Promise<boolean> {
  const row = await resolveLiveSession(input);
  if (!row || row.lastReauthAt == null) return false;
  const ageMs = Date.now() - row.lastReauthAt.getTime();
  return ageMs <= reauthWindowMinutes() * MINUTE_MS;
}
