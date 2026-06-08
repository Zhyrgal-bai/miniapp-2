import { afterEach, describe, expect, it } from "vitest";
import { buildPlatformSubscriptionFinikCreateContext } from "../../src/server/finik/buildPlatformSubscriptionFinikCreateContext.js";

describe("buildPlatformSubscriptionFinikCreateContext", () => {
  const envKeys = [
    "API_URL",
    "FINIK_USE_MOCK",
    "FINIK_API_KEY",
    "FINIK_ACCOUNT_ID",
    "PLATFORM_FINIK_API_KEY",
    "PLATFORM_FINIK_ACCOUNT_ID",
  ] as const;
  let snap: Record<string, string | undefined>;

  afterEach(() => {
    for (const k of envKeys) {
      if (snap[k] === undefined) delete process.env[k];
      else process.env[k] = snap[k];
    }
  });

  it("separates webhook callbackUrl from browser returnUrl", () => {
    snap = {};
    for (const k of envKeys) snap[k] = process.env[k];
    delete process.env.FINIK_USE_MOCK;
    process.env.API_URL = "https://api.example.com";
    process.env.FINIK_API_KEY = "key";
    process.env.FINIK_ACCOUNT_ID = "acct";

    const out = buildPlatformSubscriptionFinikCreateContext({
      subscriptionPaymentRowId: 7,
      amountSom: 1500,
    });

    expect(out.ok).toBe(true);
    if (!out.ok) return;

    expect(out.ctx.callbackUrl).toBe(
      "https://api.example.com/api/platform/subscription-finik-webhook",
    );
    expect(out.ctx.returnUrl).toBe(
      "https://api.example.com/merchant/subscription?finik=return",
    );
    expect(out.ctx.callbackUrl).not.toBe(out.ctx.returnUrl);
    expect(out.ctx.externalId).toBe("saas_sub:7");
  });
});
