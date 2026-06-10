import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

describe("API security contracts (Phase 18)", () => {
  it("mounts security middleware in index.ts", () => {
    const src = read("src/server/index.ts");
    expect(src.includes("corsMiddleware")).toBe(true);
    expect(src.includes("securityHeadersMiddleware")).toBe(true);
    expect(src.includes("requestTimeoutMiddleware")).toBe(true);
    expect(src.includes("safeErrorEnvelopeMiddleware")).toBe(true);
    expect(src.includes('origin: "*"')).toBe(false);
  });

  it("security headers set core protections", () => {
    const src = read("src/middleware/security/securityHeaders.ts");
    expect(src.includes("X-Content-Type-Options")).toBe(true);
    expect(src.includes("X-Frame-Options")).toBe(true);
    expect(src.includes("Referrer-Policy")).toBe(true);
  });

  it("CORS policy is env-driven with default wildcard", () => {
    const src = read("src/middleware/security/corsPolicy.ts");
    expect(src.includes("CORS_ALLOWED_ORIGINS")).toBe(true);
    expect(src.includes('return "*"')).toBe(true);
  });

  it("rate limiter respects TRUST_PROXY", () => {
    const src = read("src/middleware/apiRateLimits.ts");
    expect(src.includes("TRUST_PROXY")).toBe(true);
    expect(src.includes("trustProxy: trustProxyEnabled()")).toBe(true);
    expect(src.includes("logRateLimitHit")).toBe(true);
  });

  it("subscription finik webhook has dedicated limiter", () => {
    const src = read("src/server/index.ts");
    expect(
      src.includes(
        'app.use("/api/platform/subscription-finik-webhook", webhooksLimiter)',
      ),
    ).toBe(true);
  });

  it("telemetry endpoint has stricter rate limit", () => {
    const src = read("src/server/index.ts");
    expect(src.includes("telemetryLimiter")).toBe(true);
    expect(src.includes('"/api/telemetry/client-error"')).toBe(true);
  });

  it(".env.example documents security vars without real secrets", () => {
    const env = read(".env.example");
    expect(env.includes("CORS_ALLOWED_ORIGINS")).toBe(true);
    expect(env.includes("TELEGRAM_INITDATA_MAX_AGE_SEC")).toBe(true);
    expect(env.includes("CLOUDINARY_CLOUD_NAME")).toBe(true);
    expect(env).not.toMatch(/BOT_TOKEN=\d+:[A-Za-z0-9_-]{20,}/);
    expect(env).not.toMatch(/sk_live_[A-Za-z0-9]+/);
  });

  it("frontend .env is gitignored", () => {
    const gi = read(".gitignore");
    expect(gi.includes("frontend/.env")).toBe(true);
  });
});
