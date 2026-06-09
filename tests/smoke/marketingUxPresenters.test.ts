import { describe, expect, it } from "vitest";
import {
  campaignStatusBadge,
  formatBudget,
  formatPromotionValue,
  formatRoi,
  promotionStatusBadge,
  promotionTypeLabel,
} from "../../frontend/src/utils/marketingUx";

describe("marketingUx presenters", () => {
  it("maps promotion status badges", () => {
    expect(promotionStatusBadge("ACTIVE").tone).toBe("green");
    expect(promotionStatusBadge("ENDED").tone).toBe("red");
    expect(promotionStatusBadge("DRAFT").tone).toBe("gray");
  });

  it("maps campaign status badges", () => {
    expect(campaignStatusBadge("PAUSED").tone).toBe("amber");
    expect(campaignStatusBadge("SCHEDULED").tone).toBe("blue");
  });

  it("labels promotion types", () => {
    expect(promotionTypeLabel("FREE_DELIVERY")).toBe("Бесплатная доставка");
    expect(promotionTypeLabel("COUPON_PERCENT")).toBe("Промокод %");
  });

  it("formats promotion value", () => {
    expect(formatPromotionValue({ type: "PERCENT", percent: 20, fixedAmountSom: null })).toBe("20%");
    expect(formatPromotionValue({ type: "FIXED", percent: null, fixedAmountSom: 500 })).toBe("500 сом");
    expect(formatPromotionValue({ type: "FREE_DELIVERY", percent: null, fixedAmountSom: null })).toBe("Доставка 0 сом");
  });

  it("formats ROI and budget", () => {
    expect(formatRoi(5)).toBe("5x");
    expect(formatRoi(null)).toBe("—");
    expect(formatBudget(1234567)).toBe("1 234 567 сом");
    expect(formatBudget(0)).toBe("Без бюджета");
  });
});
