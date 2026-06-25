import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as structuredLog from "../../src/server/structuredLog.js";
import { createDeliveryHealthService } from "../../src/server/delivery/services/deliveryHealthService.js";
import type { ProviderDeliveryRepository } from "../../src/server/delivery/repositories/providerDeliveryRepository.js";

describe("deliveryHealthService", () => {
  beforeEach(() => {
    vi.spyOn(structuredLog, "emitStructuredLog").mockImplementation(() => {});
    vi.stubEnv("YANDEX_DELIVERY_OAUTH_TOKEN", "test-token");
    vi.stubEnv("DELIVERY_RECOVERY_ENABLED", "1");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns counts without secrets", async () => {
    const repository: ProviderDeliveryRepository = {
      findByOrderId: vi.fn(),
      findByProviderClaimId: vi.fn(),
      findActiveForRecovery: vi.fn(),
      findRecoveryRequiredDue: vi.fn(),
      countByStatus: vi.fn().mockImplementation(async (statuses: string[]) => {
        if (statuses.length === 1 && statuses[0] === "RECOVERY_REQUIRED") return 2;
        if (statuses.includes("FAILED") && statuses.includes("RECOVERY_REQUIRED")) return 3;
        return 12;
      }),
      countByBusinessAndStatuses: vi.fn(),
      aggregateEtaAndPrice: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateTrackingSnapshot: vi.fn(),
      updateRecoveryState: vi.fn(),
      clearRecoveryState: vi.fn(),
      appendStatusEvent: vi.fn(),
    };

    const service = createDeliveryHealthService({
      repository,
      countDue: async () => 1,
    });

    const snapshot = await service.getHealthSnapshot();

    expect(snapshot.activeDeliveries).toBe(12);
    expect(snapshot.recoveringDeliveries).toBe(2);
    expect(snapshot.failedDeliveries).toBe(3);
    expect(snapshot.queue.recoveryEnabled).toBe(true);
    expect(snapshot.queue.dueCount).toBe(1);
    expect(snapshot).not.toHaveProperty("oauthToken");
    expect(JSON.stringify(snapshot)).not.toContain("test-token");
  });
});
