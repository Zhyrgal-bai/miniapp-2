import { describe, expect, it, vi } from "vitest";
import { createDeliveryStatusSyncService } from "../../src/server/delivery/services/deliveryStatusSyncService.js";

describe("deliveryStatusSyncService", () => {
  it("updates deliveryStatus and deliveryStage without touching Order.status", async () => {
    const updateOrder = vi.fn().mockResolvedValue({ status: "CONFIRMED" });
    const service = createDeliveryStatusSyncService({ updateOrder });

    await service.syncOrderDeliveryFields({
      orderId: 10,
      internalStatus: "DELIVERING",
    });

    expect(updateOrder).toHaveBeenCalledWith(10, {
      deliveryStatus: "DELIVERING",
    });
  });

  it("skips update when injected updateOrder rejects downgrade", async () => {
    const updateOrder = vi.fn();
    const service = createDeliveryStatusSyncService({
      updateOrder: async (orderId, data) => {
        if (data.deliveryStatus === "DELIVERING") {
          return { status: "CONFIRMED" };
        }
        updateOrder(orderId, data);
        return { status: "CONFIRMED" };
      },
    });

    await service.syncOrderDeliveryFields({
      orderId: 10,
      internalStatus: "DELIVERING",
    });

    expect(updateOrder).not.toHaveBeenCalled();
  });
});
