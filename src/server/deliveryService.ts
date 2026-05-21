import type { Prisma } from "@prisma/client";
import { DeliveryStage } from "@prisma/client";
import {
  defaultPreparationMinutes,
  estimateDeliveryAt,
  inferDeliveryStage,
  type DeliveryMode,
} from "../shared/delivery.js";
import { prisma } from "./db.js";
import { createMerchantNotification } from "./merchantNotificationsService.js";

export async function initializeOrderDelivery(
  tx: Prisma.TransactionClient,
  orderId: number,
  input: {
    deliveryMode?: DeliveryMode | null;
    preparationMinutes?: number | null;
  }
): Promise<void> {
  const mode = input.deliveryMode === "PICKUP" ? "PICKUP" : "DELIVERY";
  const prep =
    input.preparationMinutes != null && Number.isFinite(input.preparationMinutes)
      ? Math.max(5, Math.round(input.preparationMinutes))
      : defaultPreparationMinutes(mode);
  const estimatedDeliveryAt = estimateDeliveryAt(new Date(), prep, mode);
  await tx.order.update({
    where: { id: orderId },
    data: {
      deliveryMode: mode,
      preparationMinutes: prep,
      estimatedDeliveryAt,
      deliveryStage: DeliveryStage.PREPARING,
    },
  });
}

export async function syncDeliveryStageForOrderStatus(
  orderId: number,
  newStatus: string
): Promise<void> {
  const stage = inferDeliveryStage(newStatus);
  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      deliveryStage: stage as DeliveryStage,
    },
    select: {
      id: true,
      businessId: true,
      orderNumber: true,
      deliveryStage: true,
      deliveryMode: true,
    },
  });

  void createMerchantNotification({
    businessId: order.businessId,
    kind: "DELIVERY_UPDATE",
    title: "Обновление доставки",
    body: `Заказ ${order.orderNumber ?? order.id}: ${stage}`,
    href: "#/admin/orders",
  });
}

export async function patchOrderDeliveryStage(input: {
  businessId: number;
  orderId: number;
  deliveryStage: DeliveryStage;
  preparationMinutes?: number | null;
  estimatedDeliveryAt?: Date | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, businessId: input.businessId },
  });
  if (!order) return { ok: false, error: "Заказ не найден" };

  await prisma.order.update({
    where: { id: order.id },
    data: {
      deliveryStage: input.deliveryStage,
      ...(input.preparationMinutes != null
        ? { preparationMinutes: Math.max(5, Math.round(input.preparationMinutes)) }
        : {}),
      ...(input.estimatedDeliveryAt != null
        ? { estimatedDeliveryAt: input.estimatedDeliveryAt }
        : {}),
    },
  });

  void createMerchantNotification({
    businessId: input.businessId,
    kind: "DELIVERY_UPDATE",
    title: "Статус доставки обновлён",
    body: `${order.orderNumber ?? order.id}: ${input.deliveryStage}`,
    href: "#/admin/orders",
  });

  return { ok: true };
}
