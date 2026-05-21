import type { OrderStatus } from "./orderStatus.js";
import {
  loadOrderLinesForStock,
  releaseOrderStock,
} from "./inventoryService.js";
import { prisma } from "./db.js";
import { logStaleOrderReleased } from "./structuredLog.js";

const UNPAID_STATUSES: OrderStatus[] = ["NEW", "ACCEPTED", "PAID_PENDING"];

/** Release stock reserved by unpaid orders older than TTL (closed Finik window, abandoned checkout). */
export async function releaseStaleUnpaidOrders(input?: {
  businessId?: number;
  maxAgeMs?: number;
}): Promise<number> {
  const maxAgeMs = input?.maxAgeMs ?? 6 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - maxAgeMs);
  const orders = await prisma.order.findMany({
    where: {
      ...(input?.businessId != null ? { businessId: input.businessId } : {}),
      status: { in: UNPAID_STATUSES },
      createdAt: { lt: cutoff },
    },
    select: { id: true, businessId: true, status: true },
    take: 100,
  });

  let released = 0;
  for (const order of orders) {
    const lines = await loadOrderLinesForStock(order.id);
    await prisma.$transaction(async (tx) => {
      await releaseOrderStock(tx, order.businessId, order.id, lines);
      await tx.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED" },
      });
    });
    released += 1;
  }
  if (released > 0) {
    logStaleOrderReleased({
      count: released,
      maxAgeMs,
      ...(input?.businessId != null ? { businessId: input.businessId } : {}),
    });
  }
  return released;
}
