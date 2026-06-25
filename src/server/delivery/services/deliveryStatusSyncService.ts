import { DeliveryStage, type ProviderDeliveryStatus as PrismaProviderDeliveryStatus } from "@prisma/client";
import { prisma } from "../../db.js";
import {
  mapInternalStatusToDeliveryStage,
  shouldAdvanceStatus,
} from "../providers/yandex/services/YandexDeliveryStatusMapper.js";
import type { ProviderDeliveryStatus } from "../types/providerDeliveryTypes.js";

export type SyncOrderDeliveryInput = {
  orderId: number;
  internalStatus: ProviderDeliveryStatus;
};

export type SyncOrderDeliveryDeps = {
  updateOrder?: (
    orderId: number,
    data: {
      deliveryStatus: ProviderDeliveryStatus;
      deliveryStage?: DeliveryStage | null;
    },
  ) => Promise<{ status: string } | null>;
};

export function createDeliveryStatusSyncService(deps: SyncOrderDeliveryDeps = {}) {
  const updateOrder =
    deps.updateOrder ??
    (async (orderId, data) => {
      const stage = mapInternalStatusToDeliveryStage(data.deliveryStatus);
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { deliveryStatus: true, status: true },
      });
      if (!order) return null;

      const currentStatus = (order.deliveryStatus ?? "NEW") as ProviderDeliveryStatus;
      if (!shouldAdvanceStatus(currentStatus, data.deliveryStatus)) {
        return { status: order.status };
      }

      const updateData: {
        deliveryStatus: PrismaProviderDeliveryStatus;
        deliveryStage?: DeliveryStage;
      } = {
        deliveryStatus: data.deliveryStatus as PrismaProviderDeliveryStatus,
      };

      if (stage != null) {
        updateData.deliveryStage = stage;
      }

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: updateData,
        select: { status: true },
      });
      return { status: updated.status };
    });

  async function syncOrderDeliveryFields(input: SyncOrderDeliveryInput): Promise<void> {
    await updateOrder(input.orderId, {
      deliveryStatus: input.internalStatus,
    });
  }

  return { syncOrderDeliveryFields };
}

const defaultService = createDeliveryStatusSyncService();

export async function syncOrderDeliveryFields(
  input: SyncOrderDeliveryInput,
): Promise<void> {
  return defaultService.syncOrderDeliveryFields(input);
}
