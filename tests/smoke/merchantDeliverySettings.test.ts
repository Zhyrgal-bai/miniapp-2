import { describe, expect, it } from "vitest";
import {
  computeDeliveryQuote,
  defaultMerchantDeliverySettings,
  haversineDistanceKm,
  parseMerchantDeliverySettings,
} from "../../src/shared/merchantDeliverySettings.js";

describe("merchantDeliverySettings", () => {
  it("defaults to REGION_BASED for empty config", () => {
    const p = parseMerchantDeliverySettings(null);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.value.pricingMode).toBe("REGION_BASED");
    expect(p.value.regions.length).toBeGreaterThan(0);
    const q = computeDeliveryQuote({
      settings: p.value,
      fulfillmentMode: "DELIVERY",
      subtotalSom: 500,
      distanceKm: null,
      destinationLocality: { city: "Бишкек" },
    });
    expect(q.ok).toBe(true);
    if (q.ok) expect(q.deliveryFeeSom).toBeGreaterThanOrEqual(0);
  });

  it("FIXED_PRICE adds fee", () => {
    const settings = {
      ...defaultMerchantDeliverySettings(),
      pricingMode: "FIXED_PRICE" as const,
      fixedPriceSom: 100,
    };
    const q = computeDeliveryQuote({
      settings,
      fulfillmentMode: "DELIVERY",
      subtotalSom: 500,
      distanceKm: null,
    });
    expect(q.ok).toBe(true);
    if (q.ok) {
      expect(q.deliveryFeeSom).toBe(100);
      expect(q.goodsPlusDeliverySom).toBe(600);
    }
  });

  it("blocks below min order", () => {
    const settings = {
      ...defaultMerchantDeliverySettings(),
      minOrderAmountSom: 1000,
    };
    const q = computeDeliveryQuote({
      settings,
      fulfillmentMode: "DELIVERY",
      subtotalSom: 500,
      distanceKm: null,
    });
    expect(q.ok).toBe(false);
    if (!q.ok) expect(q.code).toBe("MIN_ORDER");
  });

  it("SELF_PICKUP rejects delivery fulfillment", () => {
    const settings = {
      ...defaultMerchantDeliverySettings(),
      pricingMode: "SELF_PICKUP" as const,
    };
    const q = computeDeliveryQuote({
      settings,
      fulfillmentMode: "DELIVERY",
      subtotalSom: 500,
      distanceKm: 2,
    });
    expect(q.ok).toBe(false);
    if (!q.ok) expect(q.code).toBe("PICKUP_ONLY");
  });

  it("DISTANCE_BASED uses tiers", () => {
    const settings = {
      ...defaultMerchantDeliverySettings(),
      pricingMode: "DISTANCE_BASED" as const,
      distanceTiers: [
        { maxKm: 3, priceSom: 0 },
        { maxKm: null, priceSom: 150 },
      ],
    };
    const near = computeDeliveryQuote({
      settings,
      fulfillmentMode: "DELIVERY",
      subtotalSom: 500,
      distanceKm: 2.5,
    });
    expect(near.ok).toBe(true);
    if (near.ok) expect(near.deliveryFeeSom).toBe(0);

    const far = computeDeliveryQuote({
      settings,
      fulfillmentMode: "DELIVERY",
      subtotalSom: 500,
      distanceKm: 4,
    });
    expect(far.ok).toBe(true);
    if (far.ok) expect(far.deliveryFeeSom).toBe(150);
  });

  it("haversine distance is positive", () => {
    const d = haversineDistanceKm(
      { latitude: 42.8746, longitude: 74.6122 },
      { latitude: 42.85, longitude: 74.62 },
    );
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(10);
  });
});
