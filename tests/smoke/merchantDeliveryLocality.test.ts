import { describe, expect, it } from "vitest";
import {
  resolveMerchantDeliveryRegionWithMeta,
  normalizeLocalityPart,
} from "../../src/shared/merchantDeliveryLocality.js";
import {
  DEFAULT_MERCHANT_REGIONS,
  resolveMerchantDeliveryRegion,
} from "../../src/shared/merchantDeliverySettings.js";

describe("merchantDeliveryLocality phase9.1", () => {
  it("priority 1: exact structured city match", () => {
    const result = resolveMerchantDeliveryRegionWithMeta(DEFAULT_MERCHANT_REGIONS, {
      locality: { city: "Бишкек" },
    });
    expect(result.source).toBe("structured_locality");
    expect(result.region?.name).toBe("Бишкек");
  });

  it("priority 2: exact city from parsed display address", () => {
    const result = resolveMerchantDeliveryRegionWithMeta(DEFAULT_MERCHANT_REGIONS, {
      locality: {},
      destinationLabel: "Кант, улица Ленина 1",
    });
    expect(result.source).toBe("city_exact");
    expect(result.region?.name).toBe("Кант");
  });

  it("priority 3: deprecated destinationLabel substring", () => {
    const result = resolveMerchantDeliveryRegionWithMeta(DEFAULT_MERCHANT_REGIONS, {
      locality: {},
      destinationLabel: "доставка в Токмок центр",
    });
    expect(result.source).toBe("destination_label_deprecated");
    expect(result.region?.name).toBe("Токмок");
  });

  it("structured city beats deprecated substring false positive", () => {
    const regions = [
      { id: "a", name: "Кант", priceSom: 100, notes: null },
      { id: "b", name: "Бишкек", priceSom: 150, notes: null },
    ];
    const result = resolveMerchantDeliveryRegion(regions, {
      locality: { city: "Бишкек" },
      destinationLabel: "Кантский район",
    });
    expect(result?.name).toBe("Бишкек");
  });

  it("normalizeLocalityPart is case and space insensitive", () => {
    expect(normalizeLocalityPart("  Бишкек ")).toBe("бишкек");
  });
});
