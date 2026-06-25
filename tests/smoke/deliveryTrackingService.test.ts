import { describe, expect, it } from "vitest";
import { createDeliveryTrackingService } from "../../src/server/delivery/services/deliveryTrackingService.js";
import type { ProviderDeliveryRecord } from "../../src/server/delivery/types/providerDeliveryTypes.js";
import type { ProviderDeliveryRepository } from "../../src/server/delivery/repositories/providerDeliveryRepository.js";

const record: ProviderDeliveryRecord = {
  id: 1,
  orderId: 42,
  businessId: 5,
  buyerUserId: 7,
  provider: "yandex",
  providerClaimId: "claim-1",
  providerOfferId: "express:fast",
  price: 250,
  currency: "KGS",
  status: "DELIVERING",
  providerStatus: "delivery_arrived",
  providerUpdatedAt: new Date("2026-06-10T12:00:00Z"),
  courierName: "Ivan",
  courierPhone: "+996700000000",
  vehicleNumber: "B1234KG",
  etaMinutes: 8,
  trackingUrl: "https://track.example",
  courierLat: null,
  courierLng: null,
  lastWebhookKey: "claim-1:ts",
  providerPayload: { secret: "do-not-expose" },
  lastErrorCode: null,
  lastErrorMessage: null,
  recoveryRetryCount: 0,
  recoveryNextRetryAt: null,
  recoveryLastError: null,
  createdAt: new Date("2026-06-10T10:00:00Z"),
  updatedAt: new Date("2026-06-10T12:00:00Z"),
};

describe("deliveryTrackingService", () => {
  const repository: ProviderDeliveryRepository = {
    findByOrderId: async () => record,
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

  it("customer view excludes phone and raw payload fields", async () => {
    const service = createDeliveryTrackingService({ repository });
    const result = await service.getTrackingForOrder(42, "customer");
    expect(result.ok).toBe(true);
    if (result.ok) {
      const tracking = result.tracking as Record<string, unknown>;
      expect(tracking.provider).toBe("yandex");
      expect(tracking.status).toBe("DELIVERING");
      expect(tracking.etaMinutes).toBe(8);
      expect((tracking.courier as { phone?: string }).phone).toBeUndefined();
      expect(tracking.providerStatus).toBeUndefined();
      expect(tracking.providerClaimId).toBeUndefined();
      expect(tracking.price).toBeUndefined();
    }
  });

  it("merchant view includes extended fields", async () => {
    const service = createDeliveryTrackingService({
      repository,
      loadOrderStage: async () => "OUT_FOR_DELIVERY",
    });
    const result = await service.getTrackingForOrder(42, "merchant");
    expect(result.ok).toBe(true);
    if (result.ok) {
      const tracking = result.tracking as Record<string, unknown>;
      expect(tracking.providerStatus).toBe("delivery_arrived");
      expect(tracking.providerClaimId).toBe("claim-1");
      expect(tracking.price).toBe(250);
      expect(tracking.deliveryStage).toBe("OUT_FOR_DELIVERY");
      expect((tracking.courier as { phone?: string }).phone).toBe("+996700000000");
    }
  });

  it("returns not_found when no ProviderDelivery", async () => {
    const emptyRepo: ProviderDeliveryRepository = {
      ...repository,
      findByOrderId: async () => null,
    };
    const service = createDeliveryTrackingService({ repository: emptyRepo });
    const result = await service.getTrackingForOrder(99, "customer");
    expect(result).toEqual({
      ok: false,
      code: "not_found",
      message: "Доставка не найдена.",
    });
  });
});
