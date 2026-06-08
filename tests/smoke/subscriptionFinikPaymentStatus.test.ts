import { describe, expect, it } from "vitest";
import {
  canClaimSubscriptionFinikPaymentStatus,
  SUBSCRIPTION_FINIK_PAYMENT_STATUSES,
} from "../../src/shared/subscriptionFinikPaymentStatus.js";

describe("subscriptionFinikPaymentStatus", () => {
  it("defines all payment statuses", () => {
    expect(SUBSCRIPTION_FINIK_PAYMENT_STATUSES).toEqual([
      "pending",
      "completed",
      "failed",
      "cancelled",
    ]);
  });

  it("allows webhook claim only from pending", () => {
    expect(canClaimSubscriptionFinikPaymentStatus("pending")).toBe(true);
    expect(canClaimSubscriptionFinikPaymentStatus("failed")).toBe(false);
    expect(canClaimSubscriptionFinikPaymentStatus("cancelled")).toBe(false);
    expect(canClaimSubscriptionFinikPaymentStatus("completed")).toBe(false);
  });
});
