import { describe, expect, it } from "vitest";
import { validateEnvironment } from "../../src/server/envValidation.js";

describe("production env validation", () => {
  it("rejects forbidden production flags", () => {
    const prev = { ...process.env };
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://u:p@host/db?sslmode=require";
    process.env.BOT_TOKEN_SECRET_KEY = "x".repeat(32);
    process.env.TELEGRAM_WEBHOOK_SECRET = "whsec";
    process.env.FINIK_WEBHOOK_SIGNATURE_HEADER = "x-finik-signature";
    process.env.OPERATOR_PASSWORD_HASH = "$2a$10$hash";
    process.env.SKIP_TELEGRAM_WEBAPP_AUTH = "1";
    process.env.TELEGRAM_INIT_DEBUG = "1";

    const result = validateEnvironment();
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("SKIP_TELEGRAM"))).toBe(true);
    expect(result.errors.some((e) => e.includes("TELEGRAM_INIT_DEBUG"))).toBe(
      true,
    );

    Object.assign(process.env, prev);
  });

  it("passes minimal production config", () => {
    const prev = { ...process.env };
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://u:p@host/db?sslmode=require";
    process.env.BOT_TOKEN_SECRET_KEY = "x".repeat(32);
    process.env.TELEGRAM_WEBHOOK_SECRET = "whsec";
    process.env.FINIK_WEBHOOK_SIGNATURE_HEADER = "x-finik-signature";
    process.env.OPERATOR_PASSWORD_HASH = "$2a$10$hash";
    delete process.env.SKIP_TELEGRAM_WEBAPP_AUTH;
    delete process.env.TELEGRAM_INIT_DEBUG;

    const result = validateEnvironment();
    expect(result.ok).toBe(true);

    Object.assign(process.env, prev);
  });
});
