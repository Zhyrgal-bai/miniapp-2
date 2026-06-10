import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { StorefrontPublicApiResponseSchema } from "../../src/storefront/storefrontPublicApiResponseSchema.js";

function read(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

const STAFF_SECRET_KEYS = [
  "botToken",
  "botTokenHash",
  "finikApiKey",
  "finikSecret",
  "staff",
  "permissions",
  "webhookRouteToken",
  "OPERATOR_PASSWORD_HASH",
];

describe("public storefront payload safety", () => {
  it("schema does not declare staff-only secret fields", () => {
    const shapeKeys = Object.keys(
      (StorefrontPublicApiResponseSchema as { shape?: Record<string, unknown> })
        .shape ?? {},
    );
    for (const secret of STAFF_SECRET_KEYS) {
      expect(shapeKeys.includes(secret)).toBe(false);
    }
  });

  it("storefrontPublicPayload does not assign secrets to response object", () => {
    const src = read("src/server/storefrontPublicPayload.ts");
    expect(src.includes("(payload as any).botToken")).toBe(false);
    expect(src.includes("(payload as any).finikSecret")).toBe(false);
    expect(src.includes("(payload as any).finikApiKey")).toBe(false);
    expect(src.includes("finikCheckoutReady")).toBe(true);
  });

  it("public API validates response before cache serve", () => {
    const src = read("src/server/storefrontPublicPayload.ts");
    expect(src.includes("safeParseStorefrontPublicApiResponse")).toBe(true);
  });

  it("whoami redacts telegramId in production", () => {
    const src = read("src/server/index.ts");
    expect(src.includes("[redacted]")).toBe(true);
    expect(src.includes('"/api/platform/admin/whoami"')).toBe(true);
  });
});
