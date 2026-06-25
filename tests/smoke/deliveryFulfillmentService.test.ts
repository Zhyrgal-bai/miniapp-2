import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeliveryMode } from "@prisma/client";
import * as structuredLog from "../../src/server/structuredLog.js";
import { createDeliveryFulfillmentService } from "../../src/server/delivery/services/deliveryFulfillmentService.js";
import type { ProviderDeliveryRepository } from "../../src/server/delivery/repositories/providerDeliveryRepository.js";
import type { DeliveryOfferCache } from "../../src/server/delivery/services/deliveryOfferCache.js";
import type { DeliveryMerchantResolver } from "../../src/server/delivery/services/deliveryMerchantResolver.js";

const pickup = {
  merchantId: 5,
  address: "Store",
  coordinates: { latitude: 42.87, longitude: 74.57 },
};

function makeOrder(overrides?: Partial<{
  deliveryMode: DeliveryMode;
  deliveryOfferId: string | null;
  deliveryProvider: string | null;
  lat: number | null;
  lng: number | null;
  status: string;
}>) {
  return {
    id: 100,
    businessId: 5,
    buyerUserId: 7,
    status: "CONFIRMED",
    deliveryMode: DeliveryMode.DELIVERY,
    deliveryOfferId: "express:fast",
    deliveryProvider: "yandex",
    deliveryFee: 200,
    address: "Addr",
    phone: "+996700000000",
    name: "Buyer",
    lat: 42.88,
    lng: 74.58,
    ...overrides,
  };
}

function mockRepository(): ProviderDeliveryRepository & {
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  findByOrderId: ReturnType<typeof vi.fn>;
} {
  let idSeq = 1;
  return {
    findByOrderId: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation(async (input) => ({
      id: idSeq++,
      orderId: input.orderId,
      businessId: input.businessId,
      buyerUserId: input.buyerUserId,
      provider: input.provider,
      providerClaimId: null,
      providerOfferId: input.providerOfferId,
      price: input.price ?? null,
      currency: input.currency ?? null,
      status: input.status ?? "NEW",
      providerPayload: null,
      lastErrorCode: input.lastErrorCode ?? null,
      lastErrorMessage: input.lastErrorMessage ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    update: vi.fn().mockImplementation(async (id, input) => ({
      id,
      orderId: 100,
      businessId: 5,
      buyerUserId: 7,
      provider: "yandex" as const,
      providerClaimId: input.providerClaimId ?? "claim-1",
      providerOfferId: "express:fast",
      price: input.price ?? 200,
      currency: input.currency ?? "KGS",
      status: input.status ?? "NEW",
      providerPayload: input.providerPayload ?? null,
      lastErrorCode: input.lastErrorCode ?? null,
      lastErrorMessage: input.lastErrorMessage ?? null,
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
      recoveryRetryCount: 0,
      recoveryNextRetryAt: null,
      recoveryLastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    findByProviderClaimId: vi.fn(),
    findActiveForRecovery: vi.fn(),
    findRecoveryRequiredDue: vi.fn(),
    countByStatus: vi.fn(),
    countByBusinessAndStatuses: vi.fn(),
    aggregateEtaAndPrice: vi.fn(),
    updateTrackingSnapshot: vi.fn(),
    updateRecoveryState: vi.fn(),
    clearRecoveryState: vi.fn(),
    appendStatusEvent: vi.fn(),
  };
}

describe("deliveryFulfillmentService", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.spyOn(structuredLog, "emitStructuredLog").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...envBackup };
    vi.restoreAllMocks();
  });

  it("no-ops when claims feature flag is off", async () => {
    const fulfillWithFailover = vi.fn();
    const service = createDeliveryFulfillmentService({
      claimsEnabled: () => false,
      loadOrder: async () => makeOrder(),
      fulfillWithFailover,
    });
    await service.fulfillDeliveryForPaidOrder(100);
    expect(fulfillWithFailover).not.toHaveBeenCalled();
  });

  it("skips pickup orders", async () => {
    const fulfillWithFailover = vi.fn();
    const repository = mockRepository();
    const service = createDeliveryFulfillmentService({
      claimsEnabled: () => true,
      repository,
      loadOrder: async () =>
        makeOrder({ deliveryMode: DeliveryMode.PICKUP }),
      fulfillWithFailover,
    });
    await service.fulfillDeliveryForPaidOrder(100);
    expect(repository.create).not.toHaveBeenCalled();
    expect(fulfillWithFailover).not.toHaveBeenCalled();
  });

  it("is idempotent when ProviderDelivery already exists", async () => {
    const fulfillWithFailover = vi.fn();
    const repository = mockRepository();
    repository.findByOrderId.mockResolvedValue({
      id: 1,
      orderId: 100,
      businessId: 5,
      buyerUserId: 7,
      provider: "yandex",
      providerClaimId: "existing",
      providerOfferId: "express:fast",
      price: 200,
      currency: "KGS",
      status: "SEARCHING_COURIER",
      providerPayload: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = createDeliveryFulfillmentService({
      claimsEnabled: () => true,
      repository,
      loadOrder: async () => makeOrder(),
      fulfillWithFailover,
    });
    await service.fulfillDeliveryForPaidOrder(100);
    expect(repository.create).not.toHaveBeenCalled();
    expect(fulfillWithFailover).not.toHaveBeenCalled();
  });

  it("marks FAILED when offer cache misses", async () => {
    const fulfillWithFailover = vi.fn();
    const repository = mockRepository();
    const offerCache: DeliveryOfferCache = {
      put: vi.fn(),
      get: vi.fn(),
      consume: vi.fn().mockReturnValue(null),
    };
    const resolveMerchant: DeliveryMerchantResolver = {
      resolve: vi.fn().mockResolvedValue({ ok: true, pickup }),
    };
    const service = createDeliveryFulfillmentService({
      claimsEnabled: () => true,
      repository,
      offerCache,
      resolveMerchant,
      loadOrder: async () => makeOrder(),
      fulfillWithFailover,
    });
    await service.fulfillDeliveryForPaidOrder(100);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "FAILED",
        lastErrorCode: "offer_not_found",
      }),
    );
    expect(fulfillWithFailover).not.toHaveBeenCalled();
  });

  it("skips fulfillment for merchant delivery order without offer id", async () => {
    const repository = mockRepository();
    const offerCache: DeliveryOfferCache = {
      put: vi.fn(),
      get: vi.fn(),
      consume: vi.fn(),
    };
    const resolveMerchant: DeliveryMerchantResolver = {
      resolve: vi.fn(),
    };
    const fulfillWithFailover = vi.fn();
    const service = createDeliveryFulfillmentService({
      claimsEnabled: () => true,
      repository,
      offerCache,
      resolveMerchant,
      loadOrder: async () =>
        makeOrder({
          deliveryOfferId: null,
          deliveryProvider: "merchant",
          deliveryMode: DeliveryMode.DELIVERY,
        }),
      fulfillWithFailover,
    });
    await service.fulfillDeliveryForPaidOrder(100);
    expect(fulfillWithFailover).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
    expect(offerCache.consume).not.toHaveBeenCalled();
  });

  it("skips fulfillment when deliveryProvider is merchant even if offer id present", async () => {
    const repository = mockRepository();
    const fulfillWithFailover = vi.fn();
    const service = createDeliveryFulfillmentService({
      claimsEnabled: () => true,
      repository,
      offerCache: { put: vi.fn(), get: vi.fn(), consume: vi.fn() },
      resolveMerchant: { resolve: vi.fn() },
      loadOrder: async () =>
        makeOrder({
          deliveryProvider: "merchant",
          deliveryOfferId: "stale:offer",
        }),
      fulfillWithFailover,
    });
    await service.fulfillDeliveryForPaidOrder(100);
    expect(fulfillWithFailover).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("fulfills delivery on success", async () => {
    process.env.YANDEX_DELIVERY_USE_MOCK = "1";
    const repository = mockRepository();
    const offerCache: DeliveryOfferCache = {
      put: vi.fn(),
      get: vi.fn(),
      consume: vi.fn().mockReturnValue({
        payload: "payload-xyz",
        merchantId: 5,
        price: 200,
        currency: "KGS",
        expiresAt: null,
        cachedAt: Date.now(),
      }),
    };
    const resolveMerchant: DeliveryMerchantResolver = {
      resolve: vi.fn().mockResolvedValue({ ok: true, pickup }),
    };
    const fulfillWithFailover = vi.fn().mockResolvedValue({
      ok: true,
      providerClaimId: "claim-99",
      status: "SEARCHING_COURIER",
      price: 200,
      currency: "KGS",
      internalPayload: { claim_id: "claim-99", status: "accepted" },
      providerId: "yandex",
    });
    const service = createDeliveryFulfillmentService({
      claimsEnabled: () => true,
      repository,
      offerCache,
      resolveMerchant,
      loadOrder: async () => makeOrder(),
      fulfillWithFailover,
    });
    await service.fulfillDeliveryForPaidOrder(100);
    expect(fulfillWithFailover).toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ status: "SEARCHING_COURIER" }),
    );
  });
});
