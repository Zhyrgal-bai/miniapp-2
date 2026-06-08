import { describe, expect, it } from "vitest";
import { SubscriptionStatus } from "@prisma/client";
import {
  resolveMerchantSubscriptionUiStatus,
} from "../../src/server/platformSubscriptionBilling.js";
import {
  getPlatformFinikApiKey,
  getPlatformFinikAccountId,
  isPlatformFinikLegacyHttpReady,
  isPlatformFinikOfficialReady,
  isPlatformFinikPayReady,
  isPlatformFinikReady,
} from "../../src/shared/platformFinik.js";

describe("resolveMerchantSubscriptionUiStatus", () => {
  const now = new Date("2026-05-28T12:00:00.000Z");

  it("returns TRIAL when trialing and trial end in future", () => {
    const s = resolveMerchantSubscriptionUiStatus(
      {
        isBlocked: false,
        subscriptionStatus: SubscriptionStatus.TRIALING,
        trialEndsAt: new Date("2026-06-01T00:00:00.000Z"),
        subscriptionEndsAt: null,
      },
      now,
    );
    expect(s).toBe("TRIAL");
  });

  it("returns EXPIRING when paid subscription ends within 7 days", () => {
    const s = resolveMerchantSubscriptionUiStatus(
      {
        isBlocked: false,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        subscriptionEndsAt: new Date("2026-06-04T00:00:00.000Z"),
        gracePeriodEndsAt: null,
      },
      now,
    );
    expect(s).toBe("EXPIRING");
  });

  it("returns EXPIRED when trial ended", () => {
    const s = resolveMerchantSubscriptionUiStatus(
      {
        isBlocked: false,
        subscriptionStatus: SubscriptionStatus.EXPIRED,
        trialEndsAt: new Date("2026-05-01T00:00:00.000Z"),
        subscriptionEndsAt: null,
      },
      now,
    );
    expect(s).toBe("EXPIRED");
  });

  it("returns PENDING_PAYMENT when pending Finik invoice exists", () => {
    const s = resolveMerchantSubscriptionUiStatus(
      {
        isBlocked: false,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        subscriptionEndsAt: new Date("2026-12-01T00:00:00.000Z"),
        gracePeriodEndsAt: null,
      },
      now,
      true,
    );
    expect(s).toBe("PENDING_PAYMENT");
  });

  it("returns EXPIRED when blocked", () => {
    const s = resolveMerchantSubscriptionUiStatus(
      {
        isBlocked: true,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        subscriptionEndsAt: new Date("2026-12-01T00:00:00.000Z"),
      },
      now,
    );
    expect(s).toBe("EXPIRED");
  });
});

describe("platform Finik env", () => {
  const envKeys = [
    "FINIK_USE_MOCK",
    "PLATFORM_FINIK_API_KEY",
    "PLATFORM_FINIK_ACCOUNT_ID",
    "PLATFORM_FINIK_SECRET",
    "FINIK_API_KEY",
    "FINIK_ACCOUNT_ID",
    "FINIK_PRIVATE_KEY",
    "FINIK_PUBLIC_KEY",
    "FINIK_RSA_PRIVATE_KEY",
  ] as const;

  function saveEnv(): Record<string, string | undefined> {
    const snap: Record<string, string | undefined> = {};
    for (const k of envKeys) snap[k] = process.env[k];
    return snap;
  }

  function restoreEnv(snap: Record<string, string | undefined>): void {
    for (const k of envKeys) {
      if (snap[k] === undefined) delete process.env[k];
      else process.env[k] = snap[k];
    }
  }

  it("isPlatformFinikReady is true when mock enabled", () => {
    const snap = saveEnv();
    process.env.FINIK_USE_MOCK = "1";
    try {
      expect(isPlatformFinikReady()).toBe(true);
    } finally {
      restoreEnv(snap);
    }
  });

  it("isPlatformFinikReady accepts FINIK_* without PLATFORM_*", () => {
    const snap = saveEnv();
    delete process.env.FINIK_USE_MOCK;
    delete process.env.PLATFORM_FINIK_API_KEY;
    delete process.env.PLATFORM_FINIK_ACCOUNT_ID;
    process.env.FINIK_API_KEY = "k";
    process.env.FINIK_ACCOUNT_ID = "acct";
    try {
      expect(isPlatformFinikReady()).toBe(true);
      expect(getPlatformFinikApiKey()).toBe("k");
      expect(getPlatformFinikAccountId()).toBe("acct");
    } finally {
      restoreEnv(snap);
    }
  });

  it("isPlatformFinikOfficialReady requires RSA keys", () => {
    const snap = saveEnv();
    delete process.env.FINIK_USE_MOCK;
    process.env.FINIK_API_KEY = "k";
    process.env.FINIK_ACCOUNT_ID = "acct";
    delete process.env.FINIK_PRIVATE_KEY;
    delete process.env.FINIK_RSA_PRIVATE_KEY;
    delete process.env.FINIK_PUBLIC_KEY;
    try {
      expect(isPlatformFinikReady()).toBe(true);
      expect(isPlatformFinikOfficialReady()).toBe(false);
      expect(isPlatformFinikPayReady()).toBe(false);
      process.env.FINIK_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nX\\n-----END PRIVATE KEY-----";
      process.env.FINIK_PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----\\nY\\n-----END PUBLIC KEY-----";
      expect(isPlatformFinikOfficialReady()).toBe(true);
      expect(isPlatformFinikPayReady()).toBe(true);
    } finally {
      restoreEnv(snap);
    }
  });

  it("legacy secret readiness is deprecated and not used for pay", () => {
    const snap = saveEnv();
    delete process.env.FINIK_USE_MOCK;
    process.env.PLATFORM_FINIK_API_KEY = "k";
    process.env.PLATFORM_FINIK_ACCOUNT_ID = "acct";
    delete process.env.PLATFORM_FINIK_SECRET;
    try {
      expect(isPlatformFinikLegacyHttpReady()).toBe(false);
      expect(isPlatformFinikPayReady()).toBe(false);
    } finally {
      restoreEnv(snap);
    }
  });
});
