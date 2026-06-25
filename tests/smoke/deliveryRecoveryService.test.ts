import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as structuredLog from "../../src/server/structuredLog.js";
import { createDeliveryRecoveryService } from "../../src/server/delivery/services/deliveryRecoveryService.js";
import type { ProviderDeliveryRecord } from "../../src/server/delivery/types/providerDeliveryTypes.js";
import type { ProviderDeliveryRepository } from "../../src/server/delivery/repositories/providerDeliveryRepository.js";
import type { ProviderRecoveryPort } from "../../src/server/delivery/providers/deliveryProviderRecoveryPort.js";
import { resetDeliveryMetricsForTests } from "../../src/server/delivery/utils/deliveryMetrics.js";

const baseDelivery: ProviderDeliveryRecord = {
  id: 1,
  orderId: 100,
  businessId: 5,
  buyerUserId: 7,
  provider: "yandex",
  providerClaimId: "claim-abc",
  providerOfferId: "express:fast",
  price: 200,
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

describe("deliveryRecoveryService", () => {
  beforeEach(() => {
    vi.spyOn(structuredLog, "emitStructuredLog").mockImplementation(() => {});
    resetDeliveryMetricsForTests();
    vi.stubEnv("DELIVERY_RECOVERY_MAX_ATTEMPTS", "3");
    vi.stubEnv("DELIVERY_RECOVERY_RETRY_BASE_MS", "1000");
    vi.stubEnv("DELIVERY_RECOVERY_RETRY_MAX_MS", "60000");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("recovers stale active delivery via provider port", async () => {
    const refreshClaim = vi.fn().mockResolvedValue({
      ok: true,
      applied: true,
      duplicate: false,
      orderId: 100,
      internalStatus: "COURIER_ASSIGNED",
    });

    const port: ProviderRecoveryPort = {
      providerId: "yandex",
      refreshClaim,
      listActiveDeliveries: vi.fn().mockResolvedValue([baseDelivery]),
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

    const service = createDeliveryRecoveryService({
      enabled: () => true,
      providers: [port],
      repository,
      batchSize: () => 50,
    });

    const result = await service.runDeliveryRecoveryOnce();
    expect(result.scanned).toBe(1);
    expect(result.recovered).toBe(1);
    expect(refreshClaim).toHaveBeenCalledWith("claim-abc");
  });

  it("schedules retry on retryable provider failure", async () => {
    const refreshClaim = vi.fn().mockResolvedValue({
      ok: false,
      code: "timeout",
      error: "timeout",
      retryable: true,
      orderId: 100,
    });

    const port: ProviderRecoveryPort = {
      providerId: "yandex",
      refreshClaim,
      listActiveDeliveries: vi.fn().mockResolvedValue([baseDelivery]),
    };

    const updateRecoveryState = vi.fn().mockResolvedValue(baseDelivery);
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
      updateRecoveryState,
      clearRecoveryState: vi.fn(),
      appendStatusEvent: vi.fn(),
    };

    const service = createDeliveryRecoveryService({
      enabled: () => true,
      providers: [port],
      repository,
      batchSize: () => 50,
    });

    const result = await service.runDeliveryRecoveryOnce();
    expect(result.retried).toBe(1);
    expect(updateRecoveryState).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        recoveryRetryCount: 1,
        recoveryLastError: "timeout",
      }),
    );
  });

  it("moves to RECOVERY_REQUIRED after max attempts", async () => {
    const stale = { ...baseDelivery, recoveryRetryCount: 2 };
    const refreshClaim = vi.fn().mockResolvedValue({
      ok: false,
      code: "api_error",
      error: "503",
      retryable: true,
      orderId: 100,
    });

    const port: ProviderRecoveryPort = {
      providerId: "yandex",
      refreshClaim,
      listActiveDeliveries: vi.fn().mockResolvedValue([stale]),
    };

    const updateRecoveryState = vi.fn().mockResolvedValue(stale);
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
      updateRecoveryState,
      clearRecoveryState: vi.fn(),
      appendStatusEvent: vi.fn(),
    };

    const service = createDeliveryRecoveryService({
      enabled: () => true,
      providers: [port],
      repository,
      batchSize: () => 50,
    });

    const result = await service.runDeliveryRecoveryOnce();
    expect(result.deadLetter).toBe(1);
    expect(updateRecoveryState).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        status: "RECOVERY_REQUIRED",
        recoveryRetryCount: 3,
      }),
    );
  });

  it("skips when recovery disabled", async () => {
    const port: ProviderRecoveryPort = {
      providerId: "yandex",
      refreshClaim: vi.fn(),
      listActiveDeliveries: vi.fn().mockResolvedValue([baseDelivery]),
    };

    const service = createDeliveryRecoveryService({
      enabled: () => false,
      providers: [port],
    });

    const result = await service.runDeliveryRecoveryOnce();
    expect(result.scanned).toBe(0);
    expect(port.refreshClaim).not.toHaveBeenCalled();
  });
});
