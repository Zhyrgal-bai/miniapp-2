/**
 * Business.botToken в БД (шифр + hash), не отдаётся в API; расшифровка только на сервере.
 */
import crypto from "node:crypto";
import { prisma } from "./db.js";
import {
  botTokenSecretKeyConfigured,
  decrypt,
  encrypt,
  isEncryptedTokenFormat,
} from "./botTokenCrypto.js";

function cryptoSha256HexUtf8(plain: string): string {
  return crypto.createHash("sha256").update(plain, "utf8").digest("hex");
}

export function hashBotTokenSha256Hex(plain: string): string {
  const t = plain.trim();
  if (t === "") return "";
  return cryptoSha256HexUtf8(t.replace(/\s/g, "").trim());
}

function prodLikeEnv(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const r = process.env.RENDER;
  return typeof r === "string" && r.trim() !== "";
}

function normalizeStoredInput(stored: string | null | undefined): string {
  return String(stored ?? "")
    .replace(/^\ufeff+/u, "")
    .trim();
}

/**
 * Plain token из столбца Business.botToken: `enc:v1:…` → расшифровка, иначе legacy plain.
 * В validateTelegramInitData всегда передаётся только расшифрованная строка.
 */
export function plainBotTokenFromStored(stored: string | null | undefined): string {
  const raw = normalizeStoredInput(stored);
  if (raw === "") return "";
  try {
    if (isEncryptedTokenFormat(raw)) {
      const realToken = decrypt(raw).trim().replace(/^[\uFEFF\s]+/, "");
      if (
        process.env.TELEGRAM_INIT_DEBUG === "1" &&
        realToken !== ""
      ) {
        console.log("Using token:", realToken.slice(0, 10));
      }
      return realToken;
    }
    return raw;
  } catch (e) {
    console.error(
      "[businessBotToken] decrypt failed:",
      e instanceof Error ? e.message : String(e),
    );
    throw e;
  }
}

/**
 * Данные для create/update Business: ciphertext + SHA-256(token) для уникальности.
 * Без BOT_TOKEN_SECRET_KEY в dev — plain + hash (только локально).
 */
export function encryptedBotTokenRow(plainToken: string): {
  botToken: string;
  botTokenHash: string;
} {
  const plain = plainToken.replace(/\s/g, "").trim();
  if (plain === "") {
    throw new Error("empty bot token");
  }
  const botTokenHash = hashBotTokenSha256Hex(plain);
  if (prodLikeEnv() && !botTokenSecretKeyConfigured()) {
    throw new Error(
      "BOT_TOKEN_SECRET_KEY is required in production to store bot tokens",
    );
  }
  if (botTokenSecretKeyConfigured()) {
    return { botToken: encrypt(plain), botTokenHash };
  }
  return { botToken: plain, botTokenHash };
}

/**
 * После миграции: зашифровать старые plain-токены, hash не меняется.
 */
export async function encryptPlainBusinessBotTokensAtRest(): Promise<void> {
  if (!botTokenSecretKeyConfigured()) {
    if (prodLikeEnv()) {
      console.error(
        "[businessBotToken] BOT_TOKEN_SECRET_KEY missing in production — tokens not encrypted at rest",
      );
    }
    return;
  }

  const rows = await prisma.business.findMany({
    where: { NOT: { botToken: { startsWith: "enc:v1:" } } },
    select: { id: true, botToken: true, botTokenHash: true },
  });

  for (const r of rows) {
    const plain = String(r.botToken ?? "").trim();
    if (plain === "" || isEncryptedTokenFormat(plain)) continue;
    let hash = r.botTokenHash?.trim() ?? "";
    if (hash === "") {
      hash = hashBotTokenSha256Hex(plain);
    }
    const cipher = encrypt(plain);
    try {
      await prisma.business.update({
        where: { id: r.id },
        data: { botToken: cipher, botTokenHash: hash },
      });
    } catch (e) {
      console.error(
        "[businessBotToken] at-rest encrypt failed for business id",
        r.id,
        e instanceof Error ? e.message : String(e),
      );
    }
  }
}
