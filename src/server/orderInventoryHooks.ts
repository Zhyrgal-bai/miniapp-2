import type { OrderStatus } from "./orderStatus.js";
import {
  commitPaidOrderStock,
  loadOrderLinesForStock,
  releaseOrderStock,
  restorePaidOrderStock,
  restoreShippedOrderStock,
  shipOrderStock,
} from "./inventoryService.js";
import { syncDeliveryStageForOrderStatus } from "./deliveryService.js";
import { prisma } from "./db.js";

const PRE_PAID = new Set<string>(["NEW", "ACCEPTED", "PAID_PENDING"]);

export async function onOrderStatusChanged(
  orderId: number,
  from: OrderStatus,
  to: OrderStatus
): Promise<void> {
  const lines = await loadOrderLinesForStock(orderId);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { businessId: true },
  });
  if (!order) return;

  await prisma.$transaction(async (tx) => {
    if (to === "CONFIRMED" && PRE_PAID.has(from)) {
      await commitPaidOrderStock(tx, order.businessId, orderId, lines);
    }
    if (to === "SHIPPED" && from === "CONFIRMED") {
      await shipOrderStock(tx, order.businessId, orderId, lines);
    }
    if (to === "CANCELLED") {
      if (PRE_PAID.has(from)) {
        await releaseOrderStock(tx, order.businessId, orderId, lines);
      } else if (from === "CONFIRMED") {
        await restorePaidOrderStock(tx, order.businessId, orderId, lines);
      } else if (from === "SHIPPED") {
        await restoreShippedOrderStock(tx, order.businessId, orderId, lines);
      }
    }
  });

  if (to === "SHIPPED" || to === "DELIVERED" || to === "CONFIRMED") {
    await syncDeliveryStageForOrderStatus(orderId, to);
  }
}

export async function onOrderPaidConfirmed(orderId: number): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { businessId: true, status: true },
  });
  if (!order) return;
  const lines = await loadOrderLinesForStock(orderId);
  await prisma.$transaction(async (tx) => {
    await commitPaidOrderStock(tx, order.businessId, orderId, lines);
  });
  await syncDeliveryStageForOrderStatus(orderId, "CONFIRMED");
  const { incrementFreeOrderQuotaOnPaid } = await import(
    "./freeOrderQuotaService.js"
  );
  await incrementFreeOrderQuotaOnPaid(orderId);
}

export async function onOrderCancelled(orderId: number, fromStatus: string): Promise<void> {
  await onOrderStatusChanged(orderId, fromStatus as OrderStatus, "CANCELLED");
}
