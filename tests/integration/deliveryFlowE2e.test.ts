/**
 * End-to-end delivery flow verification (orchestrated, injected deps).
 * Run: npm run test:delivery-e2e
 *
 * Does not require DATABASE_URL — uses mocks for isolation.
 * Complements smoke tests in tests/smoke/* and integration DB tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeliveryMode } from "@prisma/client";
import { prisma } from "../../src/server/db.js";
import {
  clearDeliveryEnginePluginsForTests,
  registerDeliveryEnginePlugin,
} from "../../src/server/delivery/engine/ProviderRegistry.js";
import { resetProviderHealthForTests } from "../../src/server/delivery/engine/ProviderHealthService.js";
import { createHybridCheckoutDeliveryResolver } from "../../src/server/delivery/engine/hybridCheckoutDeliveryResolver.js";
import type { DeliveryEnginePlugin } from "../../src/server/delivery/engine/ports/deliveryEnginePluginPort.js";
import { createDeliveryFulfillmentService } from "../../src/server/delivery/services/deliveryFulfillmentService.js";
import type { ProviderDeliveryRepository } from "../../src/server/delivery/repositories/providerDeliveryRepository.js";
import type { DeliveryOfferCache } from "../../src/server/delivery/services/deliveryOfferCache.js";
import type { DeliveryMerchantResolver } from "../../src/server/delivery/services/deliveryMerchantResolver.js";
import { YandexWebhookService } from "../../src/server/delivery/providers/yandex/services/YandexWebhookService.js";
import type { DeliveryRefreshService } from "../../src/server/delivery/services/DeliveryRefreshService.js";
import { createDeliveryRecoveryService } from "../../src/server/delivery/services/deliveryRecoveryService.js";
import type { ProviderRecoveryPort } from "../../src/server/delivery/providers/deliveryProviderRecoveryPort.js";
import type { ProviderDeliveryRecord } from "../../src/server/delivery/types/providerDeliveryTypes.js";
import { buildStorefrontOrderFinikCreateContext } from "../../src/server/finik/buildStorefrontOrderFinikCreateContext.js";
import { createStorefrontFinikCheckoutSession } from "../../src/server/finik/createStorefrontFinikCheckoutSession.js";
import {
  MERCHANT_OWNED_DELIVERY_PROVIDER,
  requiresProviderDeliveryFulfillment,
} from "../../src/shared/hybridDeliveryCheckout.js";
import {
  defaultMerchantDeliverySettings,
  type MerchantDeliverySettings,
} from "../../src/shared/merchantDeliverySettings.js";
import {
  defaultStoreAvailabilitySettings,
  type StoreAvailabilitySettings,
} from "../../src/shared/storeAvailabilitySettings.js";
import {
  coerceCheckoutOrderTotal,
  parseCheckoutDeliveryMode,
} from "../../src/server/checkoutOrderWrite.js";
import { createDeliveryMerchantDashboardService } from "../../src/server/delivery/services/deliveryMerchantDashboardService.js";
import { createDeliveryTrackingService } from "../../src/server/delivery/services/deliveryTrackingService.js";
import {
  getDeliveryMetricsSnapshot,
  resetDeliveryMetricsForTests,
} from "../../src/server/delivery/utils/deliveryMetrics.js";
import * as structuredLog from "../../src/server/structuredLog.js";

const STORE_LAT = 42.87;
const STORE_LNG = 74.57;
const CUSTOMER_LAT = 42.88;
const CUSTOMER_LNG = 74.58;
const MERCHANT_ID = 42;
const SUBTOTAL_SOM = 1000;
const FIXED_DELIVERY_FEE = 150;

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
  calculatePrice: DeliveryEnginePlugin["calculatePrice"],
): DeliveryEnginePlugin {
  return {
    providerId: id,
    displayName: id,
    capabilities: { ...baseCaps },
    isAvailable: () => true,
    calculatePrice,
    createAndAccept: async () => ({
      ok: true,
      providerClaimId: `${id}-claim-99`,
      status: "SEARCHING_COURIER",
      price: 250,
      currency: "KGS",
      internalPayload: { claim_id: `${id}-claim-99` },
    }),
  };
}

function merchantBusinessRow(
  delivery: Partial<MerchantDeliverySettings> = {},
  availability: Partial<StoreAvailabilitySettings> = {},
) {
  return {
    deliverySettings: {
      ...defaultMerchantDeliverySettings(),
      pricingMode: "FIXED_PRICE" as const,
      fixedPriceSom: FIXED_DELIVERY_FEE,
      distanceTiers: [],
      ...delivery,
    },
    storeAvailabilitySettings: {
      ...defaultStoreAvailabilitySettings(),
      deliveryZones: [{ maxKm: 15, etaMinMinutes: 30, etaMaxMinutes: 45 }],
      ...availability,
    },
    latitude: STORE_LAT,
    longitude: STORE_LNG,
  };
}

function mockRepository(): ProviderDeliveryRepository & {
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  findByOrderId: ReturnType<typeof vi.fn>;
  findByProviderClaimId: ReturnType<typeof vi.fn>;
} {
  let idSeq = 1;
  const records = new Map<number, ProviderDeliveryRecord>();
  return {
    findByOrderId: vi.fn(async (orderId: number) => {
      for (const r of records.values()) {
        if (r.orderId === orderId) return r;
      }
      return null;
    }),
    findByProviderClaimId: vi.fn(async (claimId: string) => {
      for (const r of records.values()) {
        if (r.providerClaimId === claimId) return r;
      }
      return null;
    }),
    findActiveForRecovery: vi.fn().mockResolvedValue([]),
    findRecoveryRequiredDue: vi.fn().mockResolvedValue([]),
    countByStatus: vi.fn().mockResolvedValue(0),
    countByBusinessAndStatuses: vi.fn().mockResolvedValue(0),
    aggregateEtaAndPrice: vi.fn().mockResolvedValue({ avgEta: 20, avgPrice: 250 }),
    create: vi.fn(async (input) => {
      const record: ProviderDeliveryRecord = {
        id: idSeq++,
        orderId: input.orderId,
        businessId: input.businessId,
        buyerUserId: input.buyerUserId ?? null,
        provider: input.provider,
        providerClaimId: input.providerClaimId ?? null,
        providerOfferId: input.providerOfferId,
        price: input.price ?? null,
        currency: input.currency ?? null,
        status: input.status ?? "NEW",
        providerStatus: null,
        providerUpdatedAt: null,
        courierName: null,
        courierPhone: null,
        vehicleNumber: null,
        etaMinutes: null,
        trackingUrl: null,
        courierLat: null,
        courierLng: null,
        lastWebhookKey: null,
        providerPayload: null,
        lastErrorCode: input.lastErrorCode ?? null,
        lastErrorMessage: input.lastErrorMessage ?? null,
        recoveryRetryCount: 0,
        recoveryNextRetryAt: null,
        recoveryLastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      records.set(record.id, record);
      return record;
    }),
    update: vi.fn(async (id, input) => {
      const existing = records.get(id);
      if (!existing) throw new Error("missing");
      const updated = {
        ...existing,
        ...input,
        status: input.status ?? existing.status,
        providerClaimId: input.providerClaimId ?? existing.providerClaimId,
        updatedAt: new Date(),
      };
      records.set(id, updated);
      return updated;
    }),
    updateTrackingSnapshot: vi.fn(),
    updateRecoveryState: vi.fn(),
    clearRecoveryState: vi.fn(),
    appendStatusEvent: vi.fn(),
  };
}

describe("delivery flow E2E verification", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    clearDeliveryEnginePluginsForTests();
    resetProviderHealthForTests();
    resetDeliveryMetricsForTests();
    vi.spyOn(structuredLog, "emitStructuredLog").mockImplementation(() => {});
    vi.spyOn(prisma.business, "findUnique").mockImplementation(async (args) => {
      if ((args as { where?: { id?: number } }).where?.id === MERCHANT_ID) {
        return merchantBusinessRow() as never;
      }
      return { slug: "shop" } as never;
    });
  });

  afterEach(() => {
    clearDeliveryEnginePluginsForTests();
    resetProviderHealthForTests();
    resetDeliveryMetricsForTests();
    process.env = { ...envBackup };
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("scenario 1 — merchant fixed delivery", () => {
    it("customer checkout: hybrid resolver selects merchant with fixed fee", async () => {
      registerDeliveryEnginePlugin(
        mockPlugin("yandex", async () => ({
          ok: false,
          code: "tariff_unavailable",
          message: "Нет тарифов",
        })),
      );

      const { resolveHybridCheckoutDelivery } = createHybridCheckoutDeliveryResolver();
      const quote = await resolveHybridCheckoutDelivery({
        merchantId: MERCHANT_ID,
        destination: { latitude: CUSTOMER_LAT, longitude: CUSTOMER_LNG },
        subtotalSom: SUBTOTAL_SOM,
        fulfillmentMode: "DELIVERY",
      });

      expect(quote.ok).toBe(true);
      if (!quote.ok) return;
      expect(quote.provider).toBe(MERCHANT_OWNED_DELIVERY_PROVIDER);
      expect(quote.calculationSource).toBe("fixed");
      expect(quote.deliveryFeeSom).toBe(FIXED_DELIVERY_FEE);
      expect(quote.providerOfferId).toBeNull();
      expect(quote.fallbackUsed).toBe(true);
    });

    it("order.total includes goods subtotal + merchant delivery fee", async () => {
      const orderTotal = coerceCheckoutOrderTotal(SUBTOTAL_SOM + FIXED_DELIVERY_FEE);
      expect(orderTotal).toBe(1150);
    });

    it("payment session uses merchant Finik account with full order.total", async () => {
      process.env.FINIK_USE_MOCK = "1";
      process.env.FINIK_CREATE_API_MODE = "legacy";

      const business = {
        id: MERCHANT_ID,
        finikApiKey: "merchant-key",
        finikAccountId: "merchant-acct-42",
        finikSecret: "merchant-secret",
      };
      const orderTotal = SUBTOTAL_SOM + FIXED_DELIVERY_FEE;

      const built = buildStorefrontOrderFinikCreateContext(business, {
        orderId: 501,
        amount: orderTotal,
      });
      expect(built.ok).toBe(true);
      if (!built.ok) return;
      expect(built.ctx.tenant).toEqual({
        kind: "business",
        businessId: MERCHANT_ID,
        finikApiKey: "merchant-key",
        finikAccountId: "merchant-acct-42",
        finikSecret: "merchant-secret",
      });
      expect(built.ctx.amount).toBe(orderTotal);
      expect(built.ctx.flow).toBe("storefront_order");

      const session = await createStorefrontFinikCheckoutSession(business, {
        orderId: 501,
        amount: orderTotal,
      });
      expect(session.ok).toBe(true);
      if (session.ok) {
        expect(session.paymentUrl).toContain(`amount=${orderTotal}`);
      }
    });

    it("merchant order: deliveryOfferId null, no ProviderDelivery, no claim", async () => {
      const repository = mockRepository();
      const fulfillWithFailover = vi.fn();
      const offerCache: DeliveryOfferCache = {
        put: vi.fn(),
        get: vi.fn(),
        consume: vi.fn(),
      };

      const merchantOrder = {
        id: 501,
        businessId: MERCHANT_ID,
        buyerUserId: 9,
        status: "CONFIRMED",
        deliveryMode: DeliveryMode.DELIVERY,
        deliveryProvider: MERCHANT_OWNED_DELIVERY_PROVIDER,
        deliveryOfferId: null,
        deliveryFee: FIXED_DELIVERY_FEE,
        address: "Test address",
        phone: "+996700000001",
        name: "Customer",
        lat: CUSTOMER_LAT,
        lng: CUSTOMER_LNG,
      };

      expect(
        requiresProviderDeliveryFulfillment({
          deliveryMode: "DELIVERY",
          deliveryProvider: merchantOrder.deliveryProvider,
          deliveryOfferId: merchantOrder.deliveryOfferId,
        }),
      ).toBe(false);

      const service = createDeliveryFulfillmentService({
        claimsEnabled: () => true,
        repository,
        offerCache,
        resolveMerchant: { resolve: vi.fn() },
        fulfillWithFailover,
        loadOrder: async () => merchantOrder,
      });

      await service.fulfillDeliveryForPaidOrder(501);

      expect(repository.create).not.toHaveBeenCalled();
      expect(fulfillWithFailover).not.toHaveBeenCalled();
      expect(offerCache.consume).not.toHaveBeenCalled();
    });
  });

  describe("scenario 2 — Yandex delivery", () => {
    const YANDEX_OFFER_ID = "yandex:live-offer-e2e";
    const YANDEX_CLAIM_ID = "yandex-claim-99";

    it("hybrid resolver selects Yandex and returns live quote with offer id", async () => {
      registerDeliveryEnginePlugin(
        mockPlugin("yandex", async () => ({
          ok: true,
          quote: {
            provider: "yandex",
            available: true,
            price: 250,
            currency: "KGS",
            etaMinutes: 22,
            providerOfferId: YANDEX_OFFER_ID,
            expiresAt: null,
          },
        })),
      );

      const { resolveHybridCheckoutDelivery } = createHybridCheckoutDeliveryResolver();
      const quote = await resolveHybridCheckoutDelivery({
        merchantId: MERCHANT_ID,
        destination: { latitude: CUSTOMER_LAT, longitude: CUSTOMER_LNG },
        subtotalSom: SUBTOTAL_SOM,
        fulfillmentMode: "DELIVERY",
      });

      expect(quote.ok).toBe(true);
      if (!quote.ok) return;
      expect(quote.provider).toBe("yandex");
      expect(quote.calculationSource).toBe("live");
      expect(quote.providerOfferId).toBe(YANDEX_OFFER_ID);
      expect(quote.deliveryFeeSom).toBe(250);
      expect(getDeliveryMetricsSnapshot().checkout_delivery_live_total).toBe(1);
    });

    it("after payment: ProviderDelivery created and Yandex claim submitted", async () => {
      const repository = mockRepository();
      const fulfillWithFailover = vi.fn().mockResolvedValue({
        ok: true,
        providerClaimId: YANDEX_CLAIM_ID,
        status: "SEARCHING_COURIER",
        price: 250,
        currency: "KGS",
        internalPayload: { claim_id: YANDEX_CLAIM_ID },
        providerId: "yandex",
      });

      const pickup = {
        merchantId: MERCHANT_ID,
        address: "Store",
        coordinates: { latitude: STORE_LAT, longitude: STORE_LNG },
      };
      const resolveMerchant: DeliveryMerchantResolver = {
        resolve: vi.fn().mockResolvedValue({ ok: true, pickup }),
      };

      const offerCache: DeliveryOfferCache = {
        put: vi.fn(),
        get: vi.fn(),
        consume: vi.fn().mockReturnValue({
          payload: "offer-payload-xyz",
          merchantId: MERCHANT_ID,
          provider: "yandex",
          price: 250,
          currency: "KGS",
          expiresAt: null,
          cachedAt: Date.now(),
        }),
      };

      const yandexOrder = {
        id: 502,
        businessId: MERCHANT_ID,
        buyerUserId: 9,
        status: "CONFIRMED",
        deliveryMode: DeliveryMode.DELIVERY,
        deliveryProvider: "yandex",
        deliveryOfferId: YANDEX_OFFER_ID,
        deliveryFee: 250,
        address: "Customer address",
        phone: "+996700000002",
        name: "Buyer",
        lat: CUSTOMER_LAT,
        lng: CUSTOMER_LNG,
      };

      const service = createDeliveryFulfillmentService({
        claimsEnabled: () => true,
        repository,
        offerCache,
        resolveMerchant,
        fulfillWithFailover,
        loadOrder: async () => yandexOrder,
      });

      await service.fulfillDeliveryForPaidOrder(502);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 502,
          provider: "yandex",
          providerOfferId: YANDEX_OFFER_ID,
        }),
      );
      expect(fulfillWithFailover).toHaveBeenCalledOnce();
      expect(offerCache.consume).toHaveBeenCalledWith(YANDEX_OFFER_ID);

      const updated = await repository.findByOrderId(502);
      expect(updated?.providerClaimId).toBe(YANDEX_CLAIM_ID);
      expect(updated?.status).toBe("SEARCHING_COURIER");
      expect(getDeliveryMetricsSnapshot().delivery_created_total).toBe(1);
    });

    it("webhook updates tracking after claim", async () => {
      const record: ProviderDeliveryRecord = {
        id: 10,
        orderId: 502,
        businessId: MERCHANT_ID,
        buyerUserId: 9,
        provider: "yandex",
        providerClaimId: YANDEX_CLAIM_ID,
        providerOfferId: YANDEX_OFFER_ID,
        price: 250,
        currency: "KGS",
        status: "SEARCHING_COURIER",
        providerStatus: "accepted",
        providerUpdatedAt: new Date(),
        courierName: null,
        courierPhone: null,
        vehicleNumber: null,
        etaMinutes: null,
        trackingUrl: null,
        courierLat: null,
        courierLng: null,
        lastWebhookKey: null,
        providerPayload: {},
        lastErrorCode: null,
        lastErrorMessage: null,
        recoveryRetryCount: 0,
        recoveryNextRetryAt: null,
        recoveryLastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const refreshService: DeliveryRefreshService = {
        refreshClaim: vi.fn().mockResolvedValue({
          ok: true,
          applied: true,
          duplicate: false,
          orderId: 502,
          internalStatus: "COURIER_ASSIGNED",
        }),
      };

      const webhook = new YandexWebhookService({ refreshService });
      const result = await webhook.processWebhook({
        claimId: YANDEX_CLAIM_ID,
        updatedTs: "2026-06-10T14:00:00Z",
      });

      expect(result.ok).toBe(true);
      expect(refreshService.refreshClaim).toHaveBeenCalledWith(
        YANDEX_CLAIM_ID,
        expect.objectContaining({ source: "webhook" }),
      );

      const trackingRepo: ProviderDeliveryRepository = {
        findByOrderId: async () => ({
          ...record,
          status: "COURIER_ASSIGNED",
          courierName: "Courier",
          etaMinutes: 12,
        }),
        findByProviderClaimId: async () => record,
        findActiveForRecovery: async () => [],
        findRecoveryRequiredDue: async () => [],
        countByStatus: async () => 0,
        countByBusinessAndStatuses: async () => 0,
        aggregateEtaAndPrice: async () => ({ avgEta: null, avgPrice: null }),
        create: async () => record,
        update: async () => record,
        updateTrackingSnapshot: async () => record,
        updateRecoveryState: async () => record,
        clearRecoveryState: async () => record,
        appendStatusEvent: async () => ({ ok: true, duplicate: false, event: {} as never }),
      };

      const tracking = createDeliveryTrackingService({ repository: trackingRepo });
      const view = await tracking.getTrackingForOrder(502, "customer");
      expect(view.ok).toBe(true);
      if (view.ok) {
        expect((view.tracking as { status: string }).status).toBe("COURIER_ASSIGNED");
      }
    });

    it("recovery still works for active Yandex delivery", async () => {
      const active: ProviderDeliveryRecord = {
        id: 10,
        orderId: 502,
        businessId: MERCHANT_ID,
        buyerUserId: 9,
        provider: "yandex",
        providerClaimId: YANDEX_CLAIM_ID,
        providerOfferId: YANDEX_OFFER_ID,
        price: 250,
        currency: "KGS",
        status: "SEARCHING_COURIER",
        providerStatus: "accepted",
        providerUpdatedAt: new Date("2026-06-10T09:00:00Z"),
        courierName: null,
        courierPhone: null,
        vehicleNumber: null,
        etaMinutes: null,
        trackingUrl: null,
        courierLat: null,
        courierLng: null,
        lastWebhookKey: null,
        providerPayload: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        recoveryRetryCount: 0,
        recoveryNextRetryAt: null,
        recoveryLastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const refreshClaim = vi.fn().mockResolvedValue({
        ok: true,
        applied: true,
        duplicate: false,
        orderId: 502,
        internalStatus: "DELIVERING",
      });

      const port: ProviderRecoveryPort = {
        providerId: "yandex",
        refreshClaim,
        listActiveDeliveries: vi.fn().mockResolvedValue([active]),
      };

      const repository: ProviderDeliveryRepository = {
        findByOrderId: vi.fn(),
        findByProviderClaimId: vi.fn(),
        findActiveForRecovery: vi.fn(),
        findRecoveryRequiredDue: vi.fn().mockResolvedValue([]),
        countByStatus: vi.fn(),
        countByBusinessAndStatuses: vi.fn(),
        aggregateEtaAndPrice: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateTrackingSnapshot: vi.fn(),
        updateRecoveryState: vi.fn(),
        clearRecoveryState: vi.fn(),
        appendStatusEvent: vi.fn(),
      };

      vi.stubEnv("DELIVERY_RECOVERY_MAX_ATTEMPTS", "3");
      const recovery = createDeliveryRecoveryService({
        enabled: () => true,
        providers: [port],
        repository,
        batchSize: () => 50,
      });

      const result = await recovery.runDeliveryRecoveryOnce();
      expect(result.scanned).toBe(1);
      expect(result.recovered).toBe(1);
      expect(refreshClaim).toHaveBeenCalledWith(YANDEX_CLAIM_ID);
    });
  });

  describe("scenario 3 — regression (checkout, payment, ops surfaces)", () => {
    it("checkout helpers parse delivery mode and coerce totals", () => {
      expect(parseCheckoutDeliveryMode({ deliveryType: "pickup" })).toBe(DeliveryMode.PICKUP);
      expect(parseCheckoutDeliveryMode({ deliveryType: "delivery" })).toBe(DeliveryMode.DELIVERY);
      expect(coerceCheckoutOrderTotal(999.4)).toBe(999);
    });

    it("merchant dashboard aggregates tenant-scoped delivery stats", async () => {
      const repository: ProviderDeliveryRepository = {
        findByOrderId: vi.fn(),
        findByProviderClaimId: vi.fn(),
        findActiveForRecovery: vi.fn(),
        findRecoveryRequiredDue: vi.fn(),
        countByStatus: vi.fn().mockResolvedValue(2),
        countByBusinessAndStatuses: vi.fn().mockImplementation(async (_bid, statuses) => {
          if (statuses.includes("DELIVERED")) return 5;
          return 1;
        }),
        aggregateEtaAndPrice: vi.fn().mockResolvedValue({ avgEta: 18, avgPrice: 220 }),
        create: vi.fn(),
        update: vi.fn(),
        updateTrackingSnapshot: vi.fn(),
        updateRecoveryState: vi.fn(),
        clearRecoveryState: vi.fn(),
        appendStatusEvent: vi.fn(),
      };

      const dashboard = await createDeliveryMerchantDashboardService({
        repository,
        todayStart: () => new Date("2026-06-10T00:00:00Z"),
      }).getDashboard(MERCHANT_ID);

      expect(dashboard.active).toBe(2);
      expect(dashboard.completedToday).toBe(5);
      expect(dashboard.averageEtaMinutes).toBe(18);
    });

    it("hybrid checkout analytics counters remain available", async () => {
      registerDeliveryEnginePlugin(
        mockPlugin("yandex", async () => ({
          ok: false,
          code: "tariff_unavailable",
          message: "Нет тарифов",
        })),
      );
      const { resolveHybridCheckoutDelivery } = createHybridCheckoutDeliveryResolver();
      await resolveHybridCheckoutDelivery({
        merchantId: MERCHANT_ID,
        destination: { latitude: CUSTOMER_LAT, longitude: CUSTOMER_LNG },
        subtotalSom: SUBTOTAL_SOM,
        fulfillmentMode: "DELIVERY",
      });
      const metrics = getDeliveryMetricsSnapshot();
      expect(metrics.checkout_delivery_merchant_fallback_total).toBe(1);
      expect(metrics.checkout_delivery_provider_selected).toBeGreaterThan(0);
    });
  });
});
