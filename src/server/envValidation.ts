/**
 * Production environment validation — fail fast on critical misconfiguration.
 */

import {
  logFinikOfficialEnvKeysLoadStatus,
  reloadFinikKeysFromEnv,
  validateFinikOfficialEnvKeys,
} from "./finik/finikKeys.js";
import {
  getYandexDeliveryApiBaseUrl,
  getYandexDeliveryOAuthToken,
  isYandexDeliveryMockEnabled,
} from "./delivery/providers/yandex/services/yandexDeliveryConfig.js";

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
    const platformFinikKey =
      process.env.PLATFORM_FINIK_API_KEY?.trim() ||
      process.env.FINIK_API_KEY?.trim();
    const platformFinikAccountId =
      process.env.PLATFORM_FINIK_ACCOUNT_ID?.trim() ||
      process.env.FINIK_ACCOUNT_ID?.trim();
    if (!platformFinikKey || !platformFinikAccountId) {
      warnings.push(
        "FINIK_API_KEY / FINIK_ACCOUNT_ID (or PLATFORM_FINIK_*) not set — merchant self-service subscription pay disabled",
      );
    }
    const hasOfficialKeys =
      !!process.env.FINIK_PRIVATE_KEY?.trim() &&
      !!process.env.FINIK_PUBLIC_KEY?.trim();
    if (platformFinikKey && platformFinikAccountId && !hasOfficialKeys) {
      warnings.push(
        "FINIK_PRIVATE_KEY / FINIK_PUBLIC_KEY not set — ARCHA subscription Finik RSA pay disabled",
      );
    }
    if (!hasHttpsUrl("FRONT_URL") && !hasHttpsUrl("MINI_APP_URL")) {
      warnings.push(
        "FRONT_URL or MINI_APP_URL (https) required for Telegram Web App buttons",
      );
    }
    if (process.env.WEBHOOK_DEBUG === "1") {
      errors.push("WEBHOOK_DEBUG=1 is forbidden in production");
    }
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const cloudKey = process.env.CLOUDINARY_API_KEY?.trim();
    const cloudSecret = process.env.CLOUDINARY_API_SECRET?.trim();
    if (
      (cloudName || cloudKey || cloudSecret) &&
      !(cloudName && cloudKey && cloudSecret)
    ) {
      warnings.push(
        "Cloudinary partially configured — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET together",
      );
    }
  }

  if (!process.env.FRONT_URL?.trim() && !process.env.MINI_APP_URL?.trim()) {
    warnings.push("FRONT_URL / MINI_APP_URL not set — Web App links may be broken");
  }

  reloadFinikKeysFromEnv();
  warnings.push(...validateFinikOfficialEnvKeys());
  const yandexEnv = validateYandexDeliveryEnv();
  errors.push(...yandexEnv.errors);
  warnings.push(...yandexEnv.warnings);

  return { ok: errors.length === 0, errors, warnings };
}

export function validateYandexDeliveryEnv(): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const mockEnabled = isYandexDeliveryMockEnabled();
  const token = getYandexDeliveryOAuthToken();
  const apiBase = getYandexDeliveryApiBaseUrl();

  if (isProduction()) {
    if (mockEnabled) {
      errors.push("YANDEX_DELIVERY_USE_MOCK is forbidden in production");
    }
    if (!mockEnabled && token === "") {
      errors.push(
        "YANDEX_DELIVERY_OAUTH_TOKEN is required in production when mock is disabled",
      );
    }
    if (apiBase !== "" && !apiBase.startsWith("https://")) {
      warnings.push("YANDEX_DELIVERY_API_BASE should use https:// in production");
    }
  }

  return { errors, warnings };
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
