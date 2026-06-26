import { describe, expect, it } from "vitest";
import {
  migrateMerchantDeliverySettings,
  DEFAULT_MERCHANT_REGIONS,
} from "../../src/shared/merchantDeliveryMigration.js";
import {
  defaultMerchantDeliverySettings,
  parseMerchantDeliverySettings,
  resolveMerchantDeliveryRegion,
} from "../../src/shared/merchantDeliverySettings.js";

describe("merchantDeliveryMigration phase9", () => {
  it("migrates FIXED_PRICE to single region", () => {
    const out = migrateMerchantDeliverySettings({
      ...defaultMerchantDeliverySettings(),
      pricingMode: "FIXED_PRICE",
      fixedPriceSom: 120,
    });
    expect(out.pricingMode).toBe("REGION_BASED");
    expect(out.regions).toHaveLength(1);
    expect(out.regions[0]?.priceSom).toBe(120);
  });

  it("migrates DISTANCE_BASED tiers to named regions", () => {
    const out = migrateMerchantDeliverySettings({
      ...defaultMerchantDeliverySettings(),
      pricingMode: "DISTANCE_BASED",
      distanceTiers: [
        { maxKm: 5, priceSom: 100 },
        { maxKm: null, priceSom: 200 },
      ],
    });
    expect(out.regions[0]?.name).toContain("5");
    expect(out.regions[1]?.name).toMatch(/дальше/i);
  });

  it("parse applies migration for legacy FREE_DELIVERY", () => {
    const parsed = parseMerchantDeliverySettings({
      pricingMode: "FREE_DELIVERY",
      minOrderAmountSom: 0,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.pricingMode).toBe("REGION_BASED");
    expect(parsed.value.merchantDeliveryEnabled).toBe(true);
  });

  it("resolves region by structured city", () => {
    const region = resolveMerchantDeliveryRegion(DEFAULT_MERCHANT_REGIONS, {
      locality: { city: "Бишкек" },
    });
    expect(region?.name).toBe("Бишкек");
    expect(region?.priceSom).toBe(150);
  });
});
