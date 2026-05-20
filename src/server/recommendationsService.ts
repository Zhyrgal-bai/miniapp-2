import type { OrderStatus } from "@prisma/client";
import { prisma } from "./db.js";

const PAID: OrderStatus[] = ["CONFIRMED", "SHIPPED", "DELIVERED"];

export type CoPurchaseItem = {
  productId: number;
  name: string;
  score: number;
};

/** «Часто покупают вместе» from paid order line pairs. */
export async function getCoPurchaseRecommendations(input: {
  businessId: number;
  productId?: number | null;
  limit?: number;
}): Promise<CoPurchaseItem[]> {
  const bid = input.businessId;
  const limit = Math.min(Math.max(input.limit ?? 8, 1), 24);
  const anchor =
    input.productId != null &&
    Number.isInteger(input.productId) &&
    input.productId > 0
      ? input.productId
      : null;

  const since = new Date(Date.now() - 90 * 86400000);
  const items = await prisma.orderItem.findMany({
    where: {
      businessId: bid,
      productId: { not: null },
      order: {
        createdAt: { gte: since },
        status: { in: PAID },
      },
    },
    select: {
      orderId: true,
      productId: true,
      name: true,
    },
  });

  const byOrder = new Map<number, number[]>();
  const names = new Map<number, string>();
  for (const row of items) {
    const pid = row.productId;
    if (pid == null) continue;
    const list = byOrder.get(row.orderId) ?? [];
    list.push(pid);
    byOrder.set(row.orderId, list);
    if (!names.has(pid)) names.set(pid, row.name);
  }

  const scores = new Map<number, number>();
  for (const pids of byOrder.values()) {
    const unique = [...new Set(pids)];
    if (unique.length < 2) continue;
    if (anchor != null && !unique.includes(anchor)) continue;
    for (const pid of unique) {
      if (anchor != null && pid === anchor) continue;
      scores.set(pid, (scores.get(pid) ?? 0) + 1);
    }
  }

  if (anchor == null && scores.size === 0) {
    const soldRows = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        businessId: bid,
        productId: { not: null },
        order: { status: { in: [...PAID] } },
      },
      _sum: { quantity: true },
    });
    const sorted = soldRows
      .filter((r) => r.productId != null)
      .sort(
        (a, b) =>
          Number(b._sum?.quantity ?? 0) - Number(a._sum?.quantity ?? 0),
      )
      .slice(0, limit);
    const ids = sorted
      .map((r) => r.productId)
      .filter((id): id is number => id != null);
    const products =
      ids.length > 0
        ? await prisma.product.findMany({
            where: { id: { in: ids }, businessId: bid },
            select: { id: true, name: true },
          })
        : [];
    const nameById = new Map(products.map((p) => [p.id, p.name]));
    return sorted.map((r) => ({
        productId: r.productId as number,
        name: nameById.get(r.productId as number) ?? `#${r.productId}`,
        score: Number(r._sum?.quantity ?? 0),
      }));
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([productId, score]) => ({
      productId,
      name: names.get(productId) ?? `#${productId}`,
      score,
    }));
}
