import { afterEach, describe, expect, it } from "vitest";
import { buildPlatformSubscriptionFinikReturnUrl } from "../../src/server/finik/finikPlatformSubscriptionUrls.js";

describe("buildPlatformSubscriptionFinikReturnUrl", () => {
  const envKeys = ["API_URL", "FRONTEND_URL", "FRONT_URL", "PUBLIC_URL"] as const;
  let snap: Record<string, string | undefined>;

  afterEach(() => {
    for (const k of envKeys) {
      if (snap[k] === undefined) delete process.env[k];
      else process.env[k] = snap[k];
    }
  });

  it("uses API_URL for merchant subscription return path", () => {
    snap = {};
    for (const k of envKeys) snap[k] = process.env[k];
    process.env.API_URL = "https://miniapp.example.com";
    delete process.env.FRONTEND_URL;
    delete process.env.FRONT_URL;
    delete process.env.PUBLIC_URL;

    expect(buildPlatformSubscriptionFinikReturnUrl()).toBe(
      "https://miniapp.example.com/merchant/subscription?finik=return",
    );
  });

  it("falls back to FRONTEND_URL when API_URL unset", () => {
    snap = {};
    for (const k of envKeys) snap[k] = process.env[k];
    delete process.env.API_URL;
    process.env.FRONTEND_URL = "https://front.example.com";

    expect(buildPlatformSubscriptionFinikReturnUrl()).toBe(
      "https://front.example.com/merchant/subscription?finik=return",
    );
  });

  it("returns null when no public base URL configured", () => {
    snap = {};
    for (const k of envKeys) snap[k] = process.env[k];
    delete process.env.API_URL;
    delete process.env.FRONTEND_URL;
    delete process.env.FRONT_URL;
    delete process.env.PUBLIC_URL;

    expect(buildPlatformSubscriptionFinikReturnUrl()).toBeNull();
  });
});
