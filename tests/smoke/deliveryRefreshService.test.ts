import { describe, expect, it, vi } from "vitest";
import { createDeliveryRefreshService } from "../../src/server/delivery/services/DeliveryRefreshService.js";
import type { ProviderDeliveryRecord } from "../../src/server/delivery/types/providerDeliveryTypes.js";
import type { ProviderDeliveryRepository } from "../../src/server/delivery/repositories/providerDeliveryRepository.js";
import type { YandexClaimsInfoService } from "../../src/server/delivery/providers/yandex/services/YandexClaimsInfoService.js";

const delivery: ProviderDeliveryRecord = {
  id: 1,
  orderId: 42,
  businessId: 5,
  buyerUserId: 7,
  provider: "yandex",
  providerClaimId: "claim-1",
  providerOfferId: "express:fast",
  price: 200,
  currency: "KGS",
  status: "SEARCHING_COURIER",
  providerStatus: "accepted",
  providerUpdatedAt: new Date("2026-06-10T10:00:00Z"),
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

function mockRepository(
  overrides?: Partial<ProviderDeliveryRepository>,
): ProviderDeliveryRepository {
  return {
    findByOrderId: vi.fn(),
    findByProviderClaimId: vi.fn().mockResolvedValue(delivery),
    findActiveForRecovery: vi.fn(),
    findRecoveryRequiredDue: vi.fn(),
    countByStatus: vi.fn(),
    countByBusinessAndStatuses: vi.fn(),
    aggregateEtaAndPrice: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateTrackingSnapshot: vi.fn().mockResolvedValue({
      ...delivery,
      status: "COURIER_ASSIGNED",
    }),
    updateRecoveryState: vi.fn(),
    clearRecoveryState: vi.fn(),
    appendStatusEvent: vi.fn().mockResolvedValue({
      ok: true,
      duplicate: false,
      event: {} as never,
    }),
    ...overrides,
  };
}

describe("deliveryRefreshService", () => {
  it("applies snapshot on successful refresh", async () => {
    const syncOrder = { syncOrderDeliveryFields: vi.fn().mockResolvedValue(undefined) };
    const claimsInfoService: YandexClaimsInfoService = {
      getClaimInfo: vi.fn().mockResolvedValue({
        ok: true,
        snapshot: {
          providerClaimId: "claim-1",
          providerStatus: "performer_found",
          providerUpdatedAt: new Date("2026-06-10T11:00:00Z"),
          courierName: "Courier",
          courierPhone: null,
          vehicleNumber: "A001",
          etaMinutes: 10,
          trackingUrl: null,
          courierLat: null,
          courierLng: null,
        },
      }),
    };

    const service = createDeliveryRefreshService({
      repository: mockRepository(),
      claimsInfoService,
      syncOrder,
    });

    const result = await service.refreshClaim("claim-1", {
      idempotencyKey: "claim-1:ts",
      source: "webhook",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.applied).toBe(true);
      expect(result.internalStatus).toBe("COURIER_ASSIGNED");
    }
    expect(syncOrder.syncOrderDeliveryFields).toHaveBeenCalledWith({
      orderId: 42,
      internalStatus: "COURIER_ASSIGNED",
    });
  });

  it("returns duplicate when idempotency key matches", async () => {
    const repository = mockRepository({
      appendStatusEvent: vi.fn().mockResolvedValue({
        ok: true,
        duplicate: true,
        event: {} as never,
      }),
    });

    const claimsInfoService: YandexClaimsInfoService = {
      getClaimInfo: vi.fn().mockResolvedValue({
        ok: true,
        snapshot: {
          providerClaimId: "claim-1",
          providerStatus: "performer_found",
          providerUpdatedAt: new Date("2026-06-10T11:00:00Z"),
          courierName: null,
          courierPhone: null,
          vehicleNumber: null,
          etaMinutes: null,
          trackingUrl: null,
          courierLat: null,
          courierLng: null,
        },
      }),
    };

    const service = createDeliveryRefreshService({ repository, claimsInfoService });
    const result = await service.refreshClaim("claim-1", { idempotencyKey: "dup" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.duplicate).toBe(true);
      expect(result.applied).toBe(false);
    }
  });

  it("returns unknown_status without applying", async () => {
    const claimsInfoService: YandexClaimsInfoService = {
      getClaimInfo: vi.fn().mockResolvedValue({
        ok: true,
        snapshot: {
          providerClaimId: "claim-1",
          providerStatus: "mystery",
          providerUpdatedAt: new Date(),
          courierName: null,
          courierPhone: null,
          vehicleNumber: null,
          etaMinutes: null,
          trackingUrl: null,
          courierLat: null,
          courierLng: null,
        },
      }),
    };

    const repository = mockRepository();
    const service = createDeliveryRefreshService({ repository, claimsInfoService });
    const result = await service.refreshClaim("claim-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("unknown_status");
    }
    expect(repository.appendStatusEvent).not.toHaveBeenCalled();
  });
});
