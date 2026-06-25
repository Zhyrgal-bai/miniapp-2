import { describe, expect, it, vi } from "vitest";
import { createDeliveryMerchantDashboardService } from "../../src/server/delivery/services/deliveryMerchantDashboardService.js";
import type { ProviderDeliveryRepository } from "../../src/server/delivery/repositories/providerDeliveryRepository.js";

describe("deliveryMerchantDashboardService", () => {
  it("aggregates tenant-scoped counts", async () => {
    const repository: ProviderDeliveryRepository = {
      findByOrderId: vi.fn(),
      findByProviderClaimId: vi.fn(),
      findActiveForRecovery: vi.fn(),
      findRecoveryRequiredDue: vi.fn(),
      countByStatus: vi.fn().mockImplementation(async (_statuses, businessId) => {
        if (businessId !== 5) return 0;
        return 3;
      }),
      countByBusinessAndStatuses: vi.fn().mockImplementation(async (businessId, statuses) => {
        if (businessId !== 5) return 0;
        if (statuses.includes("DELIVERED")) return 10;
        if (statuses.includes("CANCELLED")) return 2;
        return 1;
      }),
      aggregateEtaAndPrice: vi.fn().mockResolvedValue({ avgEta: 15, avgPrice: 250 }),
      create: vi.fn(),
      update: vi.fn(),
      updateTrackingSnapshot: vi.fn(),
      updateRecoveryState: vi.fn(),
      clearRecoveryState: vi.fn(),
      appendStatusEvent: vi.fn(),
    };

    const service = createDeliveryMerchantDashboardService({
      repository,
      todayStart: () => new Date("2026-06-10T00:00:00Z"),
    });

    const dashboard = await service.getDashboard(5);

    expect(dashboard.active).toBe(3);
    expect(dashboard.completedToday).toBe(10);
    expect(dashboard.cancelledToday).toBe(2);
    expect(dashboard.failedToday).toBe(1);
    expect(dashboard.averageEtaMinutes).toBe(15);
    expect(dashboard.averageDeliveryPrice).toBe(250);
  });
});
