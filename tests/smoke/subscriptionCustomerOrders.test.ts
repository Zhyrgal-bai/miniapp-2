import { describe, expect, it } from "vitest";
import { SubscriptionStatus } from "@prisma/client";
import {
  canAcceptCustomerOrders,
  customerOrdersRejectionReason,
  hasValidPaidOrTrialWindow,
} from "../../src/server/subscriptionAccess.js";
import { API_ERR_STORE_SUBSCRIPTION_EXPIRED } from "../../src/shared/apiClientMessages.js";

const future = new Date(Date.now() + 7 * 86400000);
const past = new Date(Date.now() - 86400000);

describe("canAcceptCustomerOrders", () => {
  it("allows active trial", () => {
    expect(
      canAcceptCustomerOrders({
        isBlocked: false,
        isActive: true,
        subscriptionStatus: SubscriptionStatus.TRIALING,
        trialEndsAt: future,
        subscriptionEndsAt: null,
      }),
    ).toBe(true);
  });

  it("blocks expired trial immediately (B2.1)", () => {
    expect(
      canAcceptCustomerOrders({
        isBlocked: false,
        isActive: true,
        subscriptionStatus: SubscriptionStatus.TRIALING,
        trialEndsAt: past,
        subscriptionEndsAt: null,
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

  it("blocks second store without trial (B2.3)", () => {
    expect(
      canAcceptCustomerOrders({
        isBlocked: false,
        isActive: false,
        subscriptionStatus: SubscriptionStatus.EXPIRED,
        trialEndsAt: null,
        subscriptionEndsAt: null,
      }),
    ).toBe(false);
    expect(hasValidPaidOrTrialWindow({
      isBlocked: false,
      isActive: true,
      subscriptionStatus: SubscriptionStatus.EXPIRED,
      trialEndsAt: null,
      subscriptionEndsAt: null,
    })).toBe(false);
  });

  it("allows paid subscription window", () => {
    expect(
      canAcceptCustomerOrders({
        isBlocked: false,
        isActive: true,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        subscriptionEndsAt: future,
      }),
    ).toBe(true);
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
});
