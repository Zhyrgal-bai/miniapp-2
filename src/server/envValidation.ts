/**
 * Production environment validation — fail fast on critical misconfiguration.
 */

export type EnvValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function validateEnvironment(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!process.env.DATABASE_URL?.trim()) {
    errors.push("DATABASE_URL is required");
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
        "OPERATOR_PASSWORD_HASH not set — operator unlock disabled",
      );
    }
    const finikHeader = process.env.FINIK_WEBHOOK_SIGNATURE_HEADER?.trim();
    if (!finikHeader) {
      warnings.push(
        "FINIK_WEBHOOK_SIGNATURE_HEADER not set — Finik webhook signatures skipped",
      );
    }
    if (process.env.TELEGRAM_INIT_DEBUG === "1") {
      warnings.push(
        "TELEGRAM_INIT_DEBUG=1 enabled in production — disable after auth debugging",
      );
    }
  }

  if (!process.env.FRONT_URL?.trim() && !process.env.MINI_APP_URL?.trim()) {
    warnings.push("FRONT_URL / MINI_APP_URL not set — Web App links may be broken");
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function assertEnvironmentOrExit(): void {
  const result = validateEnvironment();
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
