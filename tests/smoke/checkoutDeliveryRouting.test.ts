import { describe, expect, it } from "vitest";
import {
  resolveCheckoutDeliveryRoute,
  CHECKOUT_YANDEX_ROUTE,
  CHECKOUT_MERCHANT_ROUTE,
  CHECKOUT_UNAVAILABLE_ROUTE,
  isBishkekDestination,
} from "../../src/shared/checkoutDeliveryRouting.js";
import {
  defaultMerchantDeliverySettings,
  type MerchantDeliverySettings,
} from "../../src/shared/merchantDeliverySettings.js";

function regionBasedSettings(
  overrides?: Partial<MerchantDeliverySettings>,
): MerchantDeliverySettings {
  return {
    ...defaultMerchantDeliverySettings(),
    pricingMode: "REGION_BASED",
    merchantDeliveryEnabled: true,
    ...overrides,
  };
}

describe("checkoutDeliveryRouting phase9.2", () => {
  it("routes Bishkek to Yandex", () => {
    const route = resolveCheckoutDeliveryRoute({
      deliverySettingsRaw: regionBasedSettings(),
      destinationLocality: { city: "Бишкек" },
    });
    expect(route.route).toBe(CHECKOUT_YANDEX_ROUTE);
    expect(route.reason).toBe("bishkek_yandex");
  });

  it("routes Tokmok to merchant regional pricing", () => {
    const route = resolveCheckoutDeliveryRoute({
      deliverySettingsRaw: regionBasedSettings(),
      destinationLocality: { city: "Токмок" },
    });
    expect(route.route).toBe(CHECKOUT_MERCHANT_ROUTE);
    expect(route.reason).toBe("merchant_region");
    expect(route.matchedRegionId).toBe("tokmok");
  });

  it("routes Issyk-Kul via structured region field", () => {
    const route = resolveCheckoutDeliveryRoute({
      deliverySettingsRaw: regionBasedSettings({
        regions: [
          { id: "bishkek", name: "Бишкек", priceSom: 150, notes: null },
          { id: "issyk", name: "Иссык-Куль", priceSom: 400, notes: null },
        ],
      }),
      destinationLocality: { region: "Иссык-Куль" },
    });
    expect(route.route).toBe(CHECKOUT_MERCHANT_ROUTE);
    expect(route.matchedRegionId).toBe("issyk");
  });

  it("returns unavailable when no merchant region matches", () => {
    const route = resolveCheckoutDeliveryRoute({
      deliverySettingsRaw: regionBasedSettings(),
      destinationLocality: { city: "Ош" },
    });
    expect(route.route).toBe(CHECKOUT_UNAVAILABLE_ROUTE);
    expect(route.reason).toBe("no_merchant_region");
  });

  it("never assigns Bishkek to merchant regional route", () => {
    const route = resolveCheckoutDeliveryRoute({
      deliverySettingsRaw: regionBasedSettings(),
      destinationLabel: "доставка в Бишкек центр",
    });
    expect(route.route).toBe(CHECKOUT_YANDEX_ROUTE);
  });

  it("detects Bishkek from English label", () => {
    expect(isBishkekDestination(null, "Bishkek, Chui 12")).toBe(true);
  });

  it("legacy fixed price uses merchant outside Bishkek without region name match", () => {
    const route = resolveCheckoutDeliveryRoute({
      deliverySettingsRaw: {
        ...defaultMerchantDeliverySettings(),
        pricingMode: "FIXED_PRICE",
        fixedPriceSom: 200,
      },
      destinationLocality: { city: "Токмок" },
    });
    expect(route.route).toBe(CHECKOUT_MERCHANT_ROUTE);
    expect(route.reason).toBe("legacy_merchant");
  });
});
