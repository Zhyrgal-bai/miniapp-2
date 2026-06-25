import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDeliveryEnginePluginsForTests,
  registerDeliveryEnginePlugin,
  listDeliveryEnginePlugins,
} from "../../src/server/delivery/engine/ProviderRegistry.js";
import {
  resetProviderHealthForTests,
  recordProviderHealthEvent,
  getProviderHealthMetrics,
} from "../../src/server/delivery/engine/ProviderHealthService.js";
import { createProviderSelector } from "../../src/server/delivery/engine/ProviderSelector.js";
import { pickWinningOffer } from "../../src/server/delivery/engine/ProviderScoringEngine.js";
import { providerSupports, resolveOperationsCapabilityMatrix } from "../../src/server/delivery/engine/ProviderCapabilityResolver.js";
import { defaultMerchantDeliveryProviderPolicy } from "../../src/shared/merchantDeliveryProviderPolicy.js";
import type { DeliveryEnginePlugin } from "../../src/server/delivery/engine/ports/deliveryEnginePluginPort.js";
import { createDeliveryEngine } from "../../src/server/delivery/engine/DeliveryEngine.js";

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
  price: number,
  eta: number,
): DeliveryEnginePlugin {
  return {
    providerId: id,
    displayName: id,
    capabilities: { ...baseCaps },
    isAvailable: () => true,
    calculatePrice: async () => ({
      ok: true,
      quote: {
        provider: id,
        available: true,
        price,
        currency: "KGS",
        etaMinutes: eta,
        providerOfferId: `${id}:offer`,
        expiresAt: null,
      },
    }),
    createAndAccept: async () => ({
      ok: true,
      providerClaimId: `${id}-claim`,
      status: "SEARCHING_COURIER",
      price,
      currency: "KGS",
      internalPayload: {},
    }),
  };
}

describe("deliveryEngine phase7", () => {
  beforeEach(() => {
    clearDeliveryEnginePluginsForTests();
    resetProviderHealthForTests();
    registerDeliveryEnginePlugin(mockPlugin("yandex", 200, 15));
    registerDeliveryEnginePlugin(mockPlugin("glovo", 180, 25));
  });

  afterEach(() => {
    clearDeliveryEnginePluginsForTests();
    resetProviderHealthForTests();
  });

  it("registers plugins", () => {
    expect(listDeliveryEnginePlugins()).toHaveLength(2);
  });

  it("resolves capabilities matrix for tracking provider", () => {
    const matrix = resolveOperationsCapabilityMatrix("yandex", {
      hasClaimId: true,
      inRecovery: true,
    });
    expect(matrix.refresh).toBe(true);
    expect(matrix.tracking).toBe(true);
    expect(matrix.retryRecovery).toBe(true);
    expect(matrix.cancel).toBe(false);
  });

  it("providerSupports checks capability flags", () => {
    expect(providerSupports("yandex", "calculatePrice")).toBe(true);
    expect(providerSupports("yandex", "cancelClaim")).toBe(false);
  });

  it("computes health states from events", () => {
    for (let i = 0; i < 10; i++) {
      recordProviderHealthEvent("yandex", { type: "success", responseTimeMs: 100 });
    }
    recordProviderHealthEvent("yandex", { type: "timeout" });
    const health = getProviderHealthMetrics("yandex");
    expect(health.totalRequests).toBe(11);
    expect(["HEALTHY", "DEGRADED"]).toContain(health.state);
  });

  it("selects cheapest offer", () => {
    const policy = defaultMerchantDeliveryProviderPolicy();
    const winner = pickWinningOffer(
      [
        { providerId: "yandex", price: 200, currency: "KGS", etaMinutes: 10, providerOfferId: "a", expiresAt: null, payload: "" },
        { providerId: "glovo", price: 150, currency: "KGS", etaMinutes: 20, providerOfferId: "b", expiresAt: null, payload: "" },
      ],
      "CHEAPEST",
      { policy, healthByProvider: new Map() },
    );
    expect(winner?.providerId).toBe("glovo");
  });

  it("selects fastest offer", () => {
    const policy = defaultMerchantDeliveryProviderPolicy();
    const winner = pickWinningOffer(
      [
        { providerId: "yandex", price: 200, currency: "KGS", etaMinutes: 10, providerOfferId: "a", expiresAt: null, payload: "" },
        { providerId: "glovo", price: 150, currency: "KGS", etaMinutes: 30, providerOfferId: "b", expiresAt: null, payload: "" },
      ],
      "FASTEST",
      { policy, healthByProvider: new Map() },
    );
    expect(winner?.providerId).toBe("yandex");
  });

  it("merchant priority ordering", async () => {
    const selector = createProviderSelector({
      resolvePolicy: async () => ({
        ...defaultMerchantDeliveryProviderPolicy(),
        preferredProviders: ["glovo", "yandex"],
        strategy: "MERCHANT_PRIORITY",
      }),
      resolveProviderOrder: async () => ["glovo", "yandex"],
    });

    const order = await selector.selectFailoverOrder(1);
    expect(order[0]).toBe("glovo");
  });

  it("failover tries next provider on retryable failure", async () => {
    let calls = 0;
    registerDeliveryEnginePlugin({
      ...mockPlugin("fail", 100, 10),
      createAndAccept: async () => {
        calls += 1;
        return { ok: false, code: "provider_timeout", message: "timeout" };
      },
    });
    registerDeliveryEnginePlugin({
      ...mockPlugin("ok", 100, 10),
      createAndAccept: async () => {
        calls += 1;
        return {
          ok: true,
          providerClaimId: "ok-1",
          status: "SEARCHING_COURIER",
          price: 100,
          currency: "KGS",
          internalPayload: {},
        };
      },
    });

    const engine = createDeliveryEngine({
      policyResolver: {
        resolve: async () => ({
          ...defaultMerchantDeliveryProviderPolicy(),
          preferredProviders: ["fail", "ok"],
          allowFallback: true,
        }),
        resolveProviderOrder: async () => ["fail", "ok"],
      },
    });

    const result = await engine.createAndAcceptWithFailover({
      orderId: 1,
      merchantId: 1,
      buyerUserId: null,
      offerPayload: "x",
      price: 100,
      currency: "KGS",
      pickup: { address: "a", coordinates: { latitude: 1, longitude: 1 } },
      delivery: {
        address: "b",
        coordinates: { latitude: 2, longitude: 2 },
        contactName: "c",
        contactPhone: "+996700000000",
      },
      weightKg: 1,
    });

    expect(result.ok).toBe(true);
    expect(calls).toBeGreaterThanOrEqual(2);
  });
});
