/**
 * AES-256-GCM: createCipheriv / createDecipheriv, случайный IV (12 байт).
 * Ключ: SHA-256(UTF-8) от BOT_TOKEN_SECRET_KEY (ожидается ≥32 символа в production).
 */
import crypto from "node:crypto";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function requireSecretKey(): string {
  const raw = process.env.BOT_TOKEN_SECRET_KEY?.trim();
  if (!raw || raw.length < 32) {
    throw new Error(
      "BOT_TOKEN_SECRET_KEY must be set and at least 32 characters",
    );
  }
  return raw;
}

function deriveKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

/** Шифрование строки (например bot token) для хранения в БД. */
export function encrypt(plainText: string): string {
  const secret = requireSecretKey();
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([enc, tag]);
  return (
    PREFIX +
    iv.toString("base64url") +
    "." +
    combined.toString("base64url")
  );
}

/** BOM/пробелы; ciphertext с префиксом `enc:v1:` любого регистра приводится к каноническому виду перед разбором. */
function normalizeCiphertextPrefix(sRaw: string): string {
  const s = sRaw.replace(/^\ufeff+/u, "").trim();
  const low = s.toLowerCase();
  if (!low.startsWith(PREFIX.toLowerCase())) return s;
  return PREFIX + s.slice(PREFIX.length);
}

/** Расшифровка значения из БД; legacy plain text возвращается как есть. */
export function decrypt(storedCipher: string): string {
  const sNorm = normalizeCiphertextPrefix(String(storedCipher ?? "").trim());
  if (sNorm === "") return "";
  if (!sNorm.startsWith(PREFIX)) {
    return sNorm;
  }
  const secret = requireSecretKey();
  const key = deriveKey(secret);
  const rest = sNorm.slice(PREFIX.length);
  const dot = rest.indexOf(".");
  if (dot < 0) {
    throw new Error("invalid encrypted token format");
  }
  const iv = Buffer.from(rest.slice(0, dot), "base64url");
  const combined = Buffer.from(rest.slice(dot + 1), "base64url");
  if (combined.length < AUTH_TAG_LENGTH) {
    throw new Error("invalid encrypted token payload");
  }
  const tag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const enc = combined.subarray(0, combined.length - AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    "utf8",
  );
}

export function isEncryptedTokenFormat(stored: string): boolean {
  const s = String(stored ?? "")
    .replace(/^\ufeff+/u, "")
    .trimStart();
  return s.toLowerCase().startsWith(PREFIX.toLowerCase());
}

export function botTokenSecretKeyConfigured(): boolean {
  const s = process.env.BOT_TOKEN_SECRET_KEY?.trim();
  return s != null && s.length >= 32;
}
