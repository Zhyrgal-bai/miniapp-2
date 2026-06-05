import { describe, expect, it } from "vitest";
import { SubscriptionStatus } from "@prisma/client";
import {
  resolveMerchantSubscriptionUiStatus,
} from "../../src/server/platformSubscriptionBilling.js";
import {
  getPlatformFinikCredentials,
  isPlatformFinikLegacyHttpReady,
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
  it("isPlatformFinikReady is true when mock enabled", () => {
    const prev = process.env.FINIK_USE_MOCK;
    process.env.FINIK_USE_MOCK = "1";
    try {
      expect(isPlatformFinikReady()).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.FINIK_USE_MOCK;
      else process.env.FINIK_USE_MOCK = prev;
    }
  });

  it("isPlatformFinikReady requires api key and account id", () => {
    const prevMock = process.env.FINIK_USE_MOCK;
    const prevKey = process.env.PLATFORM_FINIK_API_KEY;
    const prevAcct = process.env.PLATFORM_FINIK_ACCOUNT_ID;
    delete process.env.FINIK_USE_MOCK;
    delete process.env.PLATFORM_FINIK_API_KEY;
    delete process.env.PLATFORM_FINIK_ACCOUNT_ID;
    try {
      expect(isPlatformFinikReady()).toBe(false);
      process.env.PLATFORM_FINIK_API_KEY = "k";
      expect(isPlatformFinikReady()).toBe(false);
      process.env.PLATFORM_FINIK_ACCOUNT_ID = "acct";
      expect(isPlatformFinikReady()).toBe(true);
    } finally {
      if (prevMock === undefined) delete process.env.FINIK_USE_MOCK;
      else process.env.FINIK_USE_MOCK = prevMock;
      if (prevKey === undefined) delete process.env.PLATFORM_FINIK_API_KEY;
      else process.env.PLATFORM_FINIK_API_KEY = prevKey;
      if (prevAcct === undefined) delete process.env.PLATFORM_FINIK_ACCOUNT_ID;
      else process.env.PLATFORM_FINIK_ACCOUNT_ID = prevAcct;
    }
  });

  it("getPlatformFinikCredentials still requires legacy secret", () => {
    const prevKey = process.env.PLATFORM_FINIK_API_KEY;
    const prevSec = process.env.PLATFORM_FINIK_SECRET;
    const prevAcct = process.env.PLATFORM_FINIK_ACCOUNT_ID;
    process.env.PLATFORM_FINIK_API_KEY = "k";
    process.env.PLATFORM_FINIK_ACCOUNT_ID = "acct";
    delete process.env.PLATFORM_FINIK_SECRET;
    try {
      expect(getPlatformFinikCredentials()).toBeNull();
      expect(isPlatformFinikLegacyHttpReady()).toBe(false);
    } finally {
      if (prevKey === undefined) delete process.env.PLATFORM_FINIK_API_KEY;
      else process.env.PLATFORM_FINIK_API_KEY = prevKey;
      if (prevSec === undefined) delete process.env.PLATFORM_FINIK_SECRET;
      else process.env.PLATFORM_FINIK_SECRET = prevSec;
      if (prevAcct === undefined) delete process.env.PLATFORM_FINIK_ACCOUNT_ID;
      else process.env.PLATFORM_FINIK_ACCOUNT_ID = prevAcct;
    }
  });
});
