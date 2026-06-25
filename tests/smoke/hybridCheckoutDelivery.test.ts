import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDeliveryEnginePluginsForTests,
  registerDeliveryEnginePlugin,
} from "../../src/server/delivery/engine/ProviderRegistry.js";
import { resetProviderHealthForTests } from "../../src/server/delivery/engine/ProviderHealthService.js";
import { resetDeliveryMetricsForTests, getDeliveryMetricsSnapshot } from "../../src/server/delivery/utils/deliveryMetrics.js";
import type { DeliveryEnginePlugin } from "../../src/server/delivery/engine/ports/deliveryEnginePluginPort.js";
import { createHybridCheckoutDeliveryResolver } from "../../src/server/delivery/engine/hybridCheckoutDeliveryResolver.js";
import {
  maxMerchantDeliveryRadiusKm,
  resolveMerchantDeliveryFallback,
} from "../../src/server/delivery/engine/merchantDeliveryFallback.js";
import {
  defaultMerchantDeliverySettings,
  type MerchantDeliverySettings,
} from "../../src/shared/merchantDeliverySettings.js";
import {
  defaultStoreAvailabilitySettings,
  type StoreAvailabilitySettings,
} from "../../src/shared/storeAvailabilitySettings.js";
import { prisma } from "../../src/server/db.js";

const baseCaps = {
  calculatePrice: true,
  createClaim: true,
  acceptClaim: true,
  cancelClaim: false,
  tracking: true,
  webhook: true,
  eta: true,
  liveLocation: false,
  returnDelivery: false,
  cashOnDelivery: false,
  partialRefund: false,
  scheduledDelivery: false,
};

function mockPlugin(
  id: string,
  impl: DeliveryEnginePlugin["calculatePrice"],
): DeliveryEnginePlugin {
  return {
    providerId: id,
    displayName: id,
    capabilities: { ...baseCaps },
    isAvailable: () => true,
    calculatePrice: impl,
    createAndAccept: async () => ({
      ok: true,
      providerClaimId: `${id}-claim`,
      status: "SEARCHING_COURIER",
      price: 100,
      currency: "KGS",
      internalPayload: {},
    }),
  };
}

const storeLat = 42.87;
const storeLng = 74.57;
const customerLat = 42.88;
const customerLng = 74.58;

function merchantSettings(overrides?: Partial<MerchantDeliverySettings>): MerchantDeliverySettings {
  return {
    ...defaultMerchantDeliverySettings(),
    pricingMode: "DISTANCE_BASED",
    distanceTiers: [
      { maxKm: 5, priceSom: 100 },
      { maxKm: 10, priceSom: 200 },
    ],
    ...overrides,
  };
}

function availabilitySettings(
  overrides?: Partial<StoreAvailabilitySettings>,
): StoreAvailabilitySettings {
  return {
    ...defaultStoreAvailabilitySettings(),
    deliveryZones: [{ maxKm: 10, etaMinMinutes: 30, etaMaxMinutes: 45 }],
    ...overrides,
  };
}

import {
  isMerchantOwnedDelivery,
  requiresProviderDeliveryFulfillment,
} from "../../src/shared/hybridDeliveryCheckout.js";

describe("hybridCheckoutDelivery phase8.5", () => {
  beforeEach(() => {
    clearDeliveryEnginePluginsForTests();
    resetProviderHealthForTests();
    resetDeliveryMetricsForTests();
    vi.spyOn(prisma.business, "findUnique").mockResolvedValue({
      deliverySettings: merchantSettings(),
      storeAvailabilitySettings: availabilitySettings(),
      latitude: storeLat,
      longitude: storeLng,
    } as never);
  });

  afterEach(() => {
    clearDeliveryEnginePluginsForTests();
    resetProviderHealthForTests();
    resetDeliveryMetricsForTests();
    vi.restoreAllMocks();
  });

  it("returns live yandex quote when provider succeeds", async () => {
    registerDeliveryEnginePlugin(
      mockPlugin("yandex", async () => ({
        ok: true,
        quote: {
          provider: "yandex",
          available: true,
          price: 250,
          currency: "KGS",
          etaMinutes: 20,
          providerOfferId: "yandex:offer-1",
          expiresAt: null,
        },
      })),
    );

    const { resolveHybridCheckoutDelivery } = createHybridCheckoutDeliveryResolver();
    const result = await resolveHybridCheckoutDelivery({
      merchantId: 1,
      destination: { latitude: customerLat, longitude: customerLng },
      subtotalSom: 1000,
      fulfillmentMode: "DELIVERY",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provider).toBe("yandex");
    expect(result.calculationSource).toBe("live");
    expect(result.deliveryFeeSom).toBe(250);
    expect(result.providerOfferId).toBe("yandex:offer-1");
    expect(result.fallbackUsed).toBe(false);
    expect(getDeliveryMetricsSnapshot().checkout_delivery_live_total).toBe(1);
  });

  it("falls back to merchant pricing when yandex tariff unavailable", async () => {
    registerDeliveryEnginePlugin(
      mockPlugin("yandex", async () => ({
        ok: false,
        code: "tariff_unavailable",
        message: "Нет тарифов",
      })),
    );

    const { resolveHybridCheckoutDelivery } = createHybridCheckoutDeliveryResolver();
    const result = await resolveHybridCheckoutDelivery({
      merchantId: 1,
      destination: { latitude: customerLat, longitude: customerLng },
      subtotalSom: 1000,
      fulfillmentMode: "DELIVERY",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provider).toBe("merchant");
    expect(result.calculationSource).toBe("fixed");
    expect(result.fallbackUsed).toBe(true);
    expect(getDeliveryMetricsSnapshot().checkout_delivery_merchant_fallback_total).toBe(1);
  });

  it("returns unavailable when outside max radius", async () => {
    registerDeliveryEnginePlugin(
      mockPlugin("yandex", async () => ({
        ok: false,
        code: "tariff_unavailable",
        message: "Нет тарифов",
      })),
    );

    vi.spyOn(prisma.business, "findUnique").mockResolvedValue({
      deliverySettings: merchantSettings({
        distanceTiers: [{ maxKm: 2, priceSom: 100 }],
      }),
      storeAvailabilitySettings: availabilitySettings({
        deliveryZones: [{ maxKm: 2, etaMinMinutes: 30, etaMaxMinutes: 45 }],
      }),
      latitude: storeLat,
      longitude: storeLng,
    } as never);

    const { resolveHybridCheckoutDelivery } = createHybridCheckoutDeliveryResolver();
    const result = await resolveHybridCheckoutDelivery({
      merchantId: 1,
      destination: { latitude: 43.5, longitude: 75.5 },
      subtotalSom: 1000,
      fulfillmentMode: "DELIVERY",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("DELIVERY_UNAVAILABLE");
    expect(getDeliveryMetricsSnapshot().checkout_delivery_unavailable_total).toBe(1);
  });

  it("returns FIXED_PRICE merchant fee on fallback", async () => {
    const fixed = resolveMerchantDeliveryFallback({
      deliverySettingsRaw: merchantSettings({
        pricingMode: "FIXED_PRICE",
        fixedPriceSom: 150,
        distanceTiers: [],
      }),
      storeAvailabilityRaw: availabilitySettings(),
      storeLatitude: storeLat,
      storeLongitude: storeLng,
      customerLatitude: customerLat,
      customerLongitude: customerLng,
      subtotalSom: 500,
    });

    expect(fixed.ok).toBe(true);
    if (!fixed.ok) return;
    expect(fixed.deliveryFeeSom).toBe(150);
    expect(fixed.provider).toBe("merchant");
  });

  it("pickup skips engine and returns zero fee", async () => {
    const calculateSpy = vi.fn();
    registerDeliveryEnginePlugin(mockPlugin("yandex", calculateSpy));

    const { resolveHybridCheckoutDelivery } = createHybridCheckoutDeliveryResolver();
    const result = await resolveHybridCheckoutDelivery({
      merchantId: 1,
      destination: { latitude: customerLat, longitude: customerLng },
      subtotalSom: 1000,
      fulfillmentMode: "PICKUP",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deliveryFeeSom).toBe(0);
    expect(calculateSpy).not.toHaveBeenCalled();
  });

  it("does not fallback on invalid_coordinates", async () => {
    registerDeliveryEnginePlugin(
      mockPlugin("yandex", async () => ({
        ok: false,
        code: "invalid_coordinates",
        message: "Некорректные координаты",
      })),
    );

    const { resolveHybridCheckoutDelivery } = createHybridCheckoutDeliveryResolver();
    const result = await resolveHybridCheckoutDelivery({
      merchantId: 1,
      destination: { latitude: customerLat, longitude: customerLng },
      subtotalSom: 1000,
      fulfillmentMode: "DELIVERY",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_COORDINATES");
    expect(getDeliveryMetricsSnapshot().checkout_delivery_merchant_fallback_total).toBe(0);
  });

  it("maxMerchantDeliveryRadiusKm uses last zone then tier", () => {
    expect(
      maxMerchantDeliveryRadiusKm(
        merchantSettings({ distanceTiers: [{ maxKm: 15, priceSom: 100 }] }),
        availabilitySettings({
          deliveryZones: [{ maxKm: 8, etaMinMinutes: 20, etaMaxMinutes: 30 }],
        }),
      ),
    ).toBe(8);

    expect(
      maxMerchantDeliveryRadiusKm(
        merchantSettings({ distanceTiers: [{ maxKm: 15, priceSom: 100 }] }),
        availabilitySettings({ deliveryZones: [] }),
      ),
    ).toBe(15);
  });

  it("merchant-owned delivery helpers exclude provider fulfillment", () => {
    expect(isMerchantOwnedDelivery("merchant")).toBe(true);
    expect(isMerchantOwnedDelivery("yandex")).toBe(false);
    expect(
      requiresProviderDeliveryFulfillment({
        deliveryMode: "DELIVERY",
        deliveryProvider: "merchant",
        deliveryOfferId: null,
      }),
    ).toBe(false);
    expect(
      requiresProviderDeliveryFulfillment({
        deliveryMode: "DELIVERY",
        deliveryProvider: "yandex",
        deliveryOfferId: "yandex:offer",
      }),
    ).toBe(true);
  });
});
