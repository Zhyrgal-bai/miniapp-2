import { describe, expect, it } from "vitest";
import {
  evaluatePromotion,
  isPromotionActiveAt,
  resolvePromotionStatus,
  validatePromotionDefinition,
  type PromotionDefinition,
} from "../../src/shared/promotionEngine.js";

function promo(partial: Partial<PromotionDefinition>): PromotionDefinition {
  return {
    businessId: 1,
    type: partial.type ?? "PERCENT",
    title: partial.title ?? "Test",
    code: partial.code ?? null,
    percent: partial.percent ?? null,
    fixedAmountSom: partial.fixedAmountSom ?? null,
    minOrderSom: partial.minOrderSom ?? 0,
    giftProductId: partial.giftProductId ?? null,
    buyQuantity: partial.buyQuantity ?? null,
    getQuantity: partial.getQuantity ?? null,
    audienceSegment: partial.audienceSegment ?? null,
    startsAt: partial.startsAt ?? null,
    endsAt: partial.endsAt ?? null,
    active: partial.active ?? true,
    maxRedemptions: partial.maxRedemptions ?? 0,
    redemptions: partial.redemptions ?? 0,
  };
}

describe("promotionEngine", () => {
  it("computes percent discount deterministically", () => {
    const r = evaluatePromotion(promo({ type: "PERCENT", percent: 20 }), {
      subtotalSom: 1000,
    });
    expect(r.eligible).toBe(true);
    expect(r.discountSom).toBe(200);
  });

  it("caps fixed discount at subtotal", () => {
    const r = evaluatePromotion(promo({ type: "FIXED", fixedAmountSom: 5000 }), {
      subtotalSom: 1200,
    });
    expect(r.discountSom).toBe(1200);
  });

  it("flags free delivery and gift", () => {
    expect(evaluatePromotion(promo({ type: "FREE_DELIVERY" }), { subtotalSom: 100 }).freeDelivery).toBe(true);
    expect(
      evaluatePromotion(promo({ type: "GIFT", giftProductId: 7 }), { subtotalSom: 100 }).giftProductId,
    ).toBe(7);
  });

  it("rejects below min order", () => {
    const r = evaluatePromotion(promo({ type: "PERCENT", percent: 10, minOrderSom: 500 }), {
      subtotalSom: 100,
    });
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe("MIN_ORDER");
  });

  it("enforces audience segment", () => {
    const r = evaluatePromotion(promo({ type: "PERCENT", percent: 10, audienceSegment: "best" }), {
      subtotalSom: 1000,
      customerSegment: "recent",
    });
    expect(r.reason).toBe("AUDIENCE");
  });

  it("respects schedule window", () => {
    const now = new Date("2026-06-09T12:00:00Z");
    expect(
      isPromotionActiveAt({ active: true, startsAt: "2026-06-10T00:00:00Z", endsAt: null }, now),
    ).toBe(false);
    expect(
      isPromotionActiveAt({ active: true, startsAt: null, endsAt: "2026-06-08T00:00:00Z" }, now),
    ).toBe(false);
    expect(isPromotionActiveAt({ active: true, startsAt: null, endsAt: null }, now)).toBe(true);
  });

  it("resolves status from schedule + redemptions", () => {
    const now = new Date("2026-06-09T12:00:00Z");
    expect(resolvePromotionStatus({ active: false, startsAt: null, endsAt: null, maxRedemptions: 0, redemptions: 0 }, now)).toBe("DRAFT");
    expect(resolvePromotionStatus({ active: true, startsAt: "2026-06-10T00:00:00Z", endsAt: null, maxRedemptions: 0, redemptions: 0 }, now)).toBe("SCHEDULED");
    expect(resolvePromotionStatus({ active: true, startsAt: null, endsAt: null, maxRedemptions: 5, redemptions: 5 }, now)).toBe("ENDED");
    expect(resolvePromotionStatus({ active: true, startsAt: null, endsAt: null, maxRedemptions: 0, redemptions: 0 }, now)).toBe("ACTIVE");
  });

  it("validates definitions", () => {
    expect(validatePromotionDefinition({ title: "", type: "PERCENT", percent: 10 }).ok).toBe(false);
    expect(validatePromotionDefinition({ title: "x", type: "PERCENT", percent: 0 }).ok).toBe(false);
    expect(validatePromotionDefinition({ title: "x", type: "COUPON_PERCENT", percent: 10, code: "" }).ok).toBe(false);
    expect(validatePromotionDefinition({ title: "x", type: "COUPON_PERCENT", percent: 10, code: "SALE" }).ok).toBe(true);
    expect(validatePromotionDefinition({ title: "x", type: "FIXED", fixedAmountSom: 0 }).ok).toBe(false);
    expect(validatePromotionDefinition({ title: "x", type: "BUY_X_GET_Y", buyQuantity: 2, getQuantity: 1 }).ok).toBe(true);
  });
});
