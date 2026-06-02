/**
 * Production environment validation — fail fast on critical misconfiguration.
 */

import {
  logFinikOfficialEnvKeysLoadStatus,
  reloadFinikKeysFromEnv,
  validateFinikOfficialEnvKeys,
} from "./finik/finikKeys.js";

export type EnvValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function hasHttpsUrl(name: string): boolean {
  const v = process.env[name]?.trim();
  if (!v) return false;
  return v.startsWith("https://");
}

export function validateEnvironment(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!process.env.DATABASE_URL?.trim()) {
    errors.push("DATABASE_URL is required");
  } else if (isProduction()) {
    const db = process.env.DATABASE_URL.trim();
    if (
      /render\.com|neon\.tech|supabase\.co|amazonaws\.com/i.test(db) &&
      !/sslmode=require/i.test(db)
    ) {
      warnings.push(
        "DATABASE_URL may need sslmode=require for cloud PostgreSQL",
      );
    }
  }

  const hasBot =
    Boolean(process.env.BOT_TOKEN?.trim()) ||
    Boolean(process.env.BOT_TOKENS?.trim());
  if (!hasBot) {
    warnings.push("BOT_TOKEN / BOT_TOKENS not set — Telegram bots will not start");
  }

  if (isProduction()) {
    if (process.env.SKIP_TELEGRAM_WEBAPP_AUTH === "1") {
      errors.push(
        "SKIP_TELEGRAM_WEBAPP_AUTH=1 is forbidden in production",
      );
    }
    if (!process.env.BOT_TOKEN_SECRET_KEY?.trim()) {
      errors.push("BOT_TOKEN_SECRET_KEY is required in production");
    }
    if (!process.env.TELEGRAM_WEBHOOK_SECRET?.trim()) {
      errors.push("TELEGRAM_WEBHOOK_SECRET is required in production");
    }
    if (!process.env.OPERATOR_PASSWORD_HASH?.trim()) {
      warnings.push(
        "OPERATOR_PASSWORD_HASH not set — platform operator unlock disabled",
      );
    }
    const finikHeader =
      process.env.FINIK_WEBHOOK_SIGNATURE_HEADER?.trim() ||
      "x-finik-signature";
    if (!process.env.FINIK_WEBHOOK_SIGNATURE_HEADER?.trim()) {
      warnings.push(
        `FINIK_WEBHOOK_SIGNATURE_HEADER not set — defaulting to ${finikHeader}`,
      );
    }
    if (process.env.TELEGRAM_INIT_DEBUG === "1") {
      errors.push(
        "TELEGRAM_INIT_DEBUG=1 must not be enabled in production",
      );
    }
    if (
      process.env.FINIK_USE_MOCK === "1" ||
      process.env.FINIK_USE_MOCK === "true"
    ) {
      errors.push("FINIK_USE_MOCK is forbidden in production");
    }
    if (!hasHttpsUrl("API_URL") && !process.env.RENDER_EXTERNAL_URL?.trim()) {
      warnings.push(
        "API_URL or RENDER_EXTERNAL_URL should be set for webhooks and public links",
      );
    }
    const platformFinikKey = process.env.PLATFORM_FINIK_API_KEY?.trim();
    const platformFinikAccountId = process.env.PLATFORM_FINIK_ACCOUNT_ID?.trim();
    if (!platformFinikKey || !platformFinikAccountId) {
      warnings.push(
        "PLATFORM_FINIK_API_KEY / PLATFORM_FINIK_ACCOUNT_ID not set — merchant self-service subscription pay disabled",
      );
    }
    if (!hasHttpsUrl("FRONT_URL") && !hasHttpsUrl("MINI_APP_URL")) {
      warnings.push(
        "FRONT_URL or MINI_APP_URL (https) required for Telegram Web App buttons",
      );
    }
  }

  if (!process.env.FRONT_URL?.trim() && !process.env.MINI_APP_URL?.trim()) {
    warnings.push("FRONT_URL / MINI_APP_URL not set — Web App links may be broken");
  }

  reloadFinikKeysFromEnv();
  warnings.push(...validateFinikOfficialEnvKeys());

  return { ok: errors.length === 0, errors, warnings };
}

export function assertEnvironmentOrExit(): void {
  reloadFinikKeysFromEnv();
  const result = validateEnvironment();
  logFinikOfficialEnvKeysLoadStatus();
  for (const w of result.warnings) {
    console.warn(`[env] ${w}`);
  }
  if (!result.ok) {
    for (const e of result.errors) {
      console.error(`[env] FATAL: ${e}`);
    }
    if (isProduction()) {
      process.exit(1);
    }
  }
}
