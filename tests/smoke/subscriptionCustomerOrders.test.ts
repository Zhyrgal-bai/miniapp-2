import { describe, expect, it } from "vitest";
import { SubscriptionStatus } from "@prisma/client";
import {
  canAcceptCustomerOrders,
  customerOrdersRejectionReason,
  freeOrdersQuotaSummary,
  hasGrandfatherTrialWindow,
  hasValidPaidOrTrialWindow,
  isInSubscriptionGracePeriod,
  merchantStoreEntitled,
  resolveMerchantAccessMode,
} from "../../src/server/subscriptionAccess.js";
import {
  API_ERR_STORE_QUOTA_EXHAUSTED,
  API_ERR_STORE_SUBSCRIPTION_EXPIRED,
} from "../../src/shared/apiClientMessages.js";

const future = new Date(Date.now() + 7 * 86400000);
const past = new Date(Date.now() - 86400000);

const freeGate = (used: number) => ({
  isBlocked: false,
  isActive: true,
  subscriptionStatus: SubscriptionStatus.FREE,
  trialEndsAt: null,
  subscriptionEndsAt: null,
  freeOrdersUsed: used,
  freeOrdersLimit: 5,
});

describe("canAcceptCustomerOrders — free usage model", () => {
  it("allows free tier with remaining quota", () => {
    expect(canAcceptCustomerOrders(freeGate(0))).toBe(true);
    expect(canAcceptCustomerOrders(freeGate(4))).toBe(true);
    expect(resolveMerchantAccessMode(freeGate(2))).toBe("free");
  });

  it("blocks QUOTA_EXHAUSTED status", () => {
    const gate = {
      ...freeGate(5),
      subscriptionStatus: SubscriptionStatus.QUOTA_EXHAUSTED,
    };
    expect(canAcceptCustomerOrders(gate)).toBe(false);
    expect(customerOrdersRejectionReason(gate)).toBe(
      API_ERR_STORE_QUOTA_EXHAUSTED,
    );
    expect(resolveMerchantAccessMode(gate)).toBe("quota_exhausted");
  });

  it("blocks FREE tier when used >= limit", () => {
    const gate = freeGate(5);
    expect(canAcceptCustomerOrders(gate)).toBe(false);
    expect(customerOrdersRejectionReason(gate)).toBe(
      API_ERR_STORE_QUOTA_EXHAUSTED,
    );
  });

  it("allows grandfather active trial", () => {
    expect(
      canAcceptCustomerOrders({
        isBlocked: false,
        isActive: true,
        subscriptionStatus: SubscriptionStatus.TRIALING,
        trialEndsAt: future,
        subscriptionEndsAt: null,
        freeOrdersUsed: 3,
        freeOrdersLimit: 5,
      }),
    ).toBe(true);
    expect(hasGrandfatherTrialWindow({
      subscriptionStatus: SubscriptionStatus.TRIALING,
      trialEndsAt: future,
      subscriptionEndsAt: null,
    })).toBe(true);
  });

  it("blocks expired grandfather trial without free quota status", () => {
    expect(
      canAcceptCustomerOrders({
        isBlocked: false,
        isActive: true,
        subscriptionStatus: SubscriptionStatus.TRIALING,
        trialEndsAt: past,
        subscriptionEndsAt: null,
        freeOrdersUsed: 0,
        freeOrdersLimit: 5,
      }),
    ).toBe(false);
    expect(
      customerOrdersRejectionReason({
        isBlocked: false,
        isActive: true,
        subscriptionStatus: SubscriptionStatus.TRIALING,
        trialEndsAt: past,
        subscriptionEndsAt: null,
      }),
    ).toBe(API_ERR_STORE_SUBSCRIPTION_EXPIRED);
  });

  it("allows new store FREE even when isActive (second store fix)", () => {
    expect(canAcceptCustomerOrders(freeGate(0))).toBe(true);
  });

  it("allows paid subscription window", () => {
    expect(
      canAcceptCustomerOrders({
        isBlocked: false,
        isActive: true,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        subscriptionEndsAt: future,
        freeOrdersUsed: 5,
        freeOrdersLimit: 5,
      }),
    ).toBe(true);
    expect(hasValidPaidOrTrialWindow({
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      trialEndsAt: null,
      subscriptionEndsAt: future,
      isBlocked: false,
      isActive: true,
    })).toBe(true);
  });

  it("blocks platform block flag", () => {
    expect(
      canAcceptCustomerOrders({
        isBlocked: true,
        isActive: true,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        subscriptionEndsAt: future,
      }),
    ).toBe(false);
  });

  it("allows orders during grace period after subscription end", () => {
    const subPast = new Date(Date.now() - 86400000);
    const graceEnd = new Date(Date.now() + 5 * 86400000);
    expect(
      isInSubscriptionGracePeriod(
        { subscriptionEndsAt: subPast, gracePeriodEndsAt: graceEnd },
        new Date(),
      ),
    ).toBe(true);
    expect(
      canAcceptCustomerOrders({
        isBlocked: false,
        isActive: true,
        subscriptionStatus: SubscriptionStatus.PAST_DUE,
        trialEndsAt: null,
        subscriptionEndsAt: subPast,
        gracePeriodEndsAt: graceEnd,
      }),
    ).toBe(true);
    expect(hasValidPaidOrTrialWindow({
      subscriptionStatus: SubscriptionStatus.PAST_DUE,
      trialEndsAt: null,
      subscriptionEndsAt: subPast,
      isBlocked: false,
      isActive: true,
    })).toBe(false);
  });

  it("blocks premium settings during grace but allows storefront orders", () => {
    const subPast = new Date(Date.now() - 86400000);
    const graceEnd = new Date(Date.now() + 5 * 86400000);
    const gate = {
      isBlocked: false,
      isActive: true,
      subscriptionStatus: SubscriptionStatus.PAST_DUE,
      trialEndsAt: null,
      subscriptionEndsAt: subPast,
      gracePeriodEndsAt: graceEnd,
    };
    expect(canAcceptCustomerOrders(gate)).toBe(true);
    expect(merchantStoreEntitled(gate)).toBe(false);
  });

  it("summarizes free orders quota", () => {
    expect(freeOrdersQuotaSummary(freeGate(3))).toEqual({
      used: 3,
      limit: 5,
      remaining: 2,
    });
  });
});
