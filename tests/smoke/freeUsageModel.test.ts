import { describe, expect, it } from "vitest";
import { SubscriptionStatus } from "@prisma/client";
import {
  hasFreeOrdersRemaining,
  resolveFreeOrdersLimit,
} from "../../src/shared/freeUsageModel.js";

describe("freeUsageModel", () => {
  it("defaults free orders limit to 5", () => {
    expect(resolveFreeOrdersLimit(null)).toBe(5);
    expect(resolveFreeOrdersLimit(undefined)).toBe(5);
  });

  it("respects business freeOrdersLimit override", () => {
    expect(resolveFreeOrdersLimit(10)).toBe(10);
  });

  it("detects remaining free quota", () => {
    expect(
      hasFreeOrdersRemaining({
        subscriptionStatus: SubscriptionStatus.FREE,
        freeOrdersUsed: 4,
        freeOrdersLimit: 5,
      }),
    ).toBe(true);
    expect(
      hasFreeOrdersRemaining({
        subscriptionStatus: SubscriptionStatus.FREE,
        freeOrdersUsed: 5,
        freeOrdersLimit: 5,
      }),
    ).toBe(false);
  });
});
