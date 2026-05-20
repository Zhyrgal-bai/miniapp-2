import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";

const PAID_STATUSES = new Set<string>(["CONFIRMED", "SHIPPED", "DELIVERED"]);

export type MerchantAnalyticsPayload = {
  totalOrders: number;
  totalRevenue: number;
  accepted: number;
  pending: number;
  shipped: number;
  delivered: number;
  done: number;
  byStatus: Record<string, number>;
  rangeDays: number;
  rangeSince: string;
  ordersInRange: number;
  revenueInRange: number;
  paidOrdersInRange: number;
  averageOrderValue: number;
  conversionRate: number | null;
  repeatCustomers: number;
  visitorsInRange: number;
  uniqueVisitorsInRange: number;
  dau: number;
  wau: number;
  dailySeries: Array<{ day: string; revenue: number; orders: number; visitors: number }>;
  topSku: Array<{ productId: number | null; name: string; quantity: number; revenue: number }>;
  support: {
    openTickets: number;
    pendingMerchant: number;
    resolvedInRange: number;
    openReturns: number;
  };
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function buildMerchantAnalytics(input: {
  businessId: number;
  rangeDays: 7 | 30 | 90;
}): Promise<MerchantAnalyticsPayload> {
  const since = new Date(Date.now() - input.rangeDays * 86400000);
  const bid = input.businessId;

  const [orders, ordersInRange, eventsInRange, orderItemsInRange, supportCounts] =
    await Promise.all([
      prisma.order.findMany({
        where: { businessId: bid },
        select: { id: true, status: true, total: true, buyerUserId: true },
      }),
      prisma.order.findMany({
        where: { businessId: bid, createdAt: { gte: since } },
        select: { id: true, total: true, status: true, createdAt: true },
      }),
      prisma.storefrontEvent
        .findMany({
          where: { businessId: bid, createdAt: { gte: since } },
          select: {
            eventType: true,
            visitorKey: true,
            createdAt: true,
          },
        })
        .catch(() => [] as Array<{ eventType: string; visitorKey: string; createdAt: Date }>),
      prisma.orderItem.findMany({
        where: {
          businessId: bid,
          productId: { not: null },
          order: { createdAt: { gte: since } },
        },
        select: { productId: true, name: true, quantity: true, price: true },
      }),
      Promise.all([
        prisma.supportTicket.count({
          where: {
            businessId: bid,
            status: { in: ["OPEN", "PENDING_MERCHANT", "PENDING_CUSTOMER"] },
          },
        }),
        prisma.supportTicket.count({
          where: { businessId: bid, status: "PENDING_MERCHANT" },
        }),
        prisma.supportTicket.count({
          where: {
            businessId: bid,
            status: { in: ["RESOLVED", "CLOSED"] },
            updatedAt: { gte: since },
          },
        }),
        prisma.returnRequest.count({
          where: {
            businessId: bid,
            status: { in: ["PENDING", "APPROVED"] },
          },
        }),
      ]),
    ]);

  const paidOrders = orders.filter((o) => PAID_STATUSES.has(o.status));
  const totalRevenue = paidOrders.reduce((s, o) => s + o.total, 0);
  const accepted = orders.filter((o) => o.status === "ACCEPTED").length;
  const pending = orders.filter((o) => o.status === "PAID_PENDING").length;
  const shipped = orders.filter((o) => o.status === "SHIPPED").length;
  const delivered = orders.filter((o) => o.status === "DELIVERED").length;

  const byStatus: Record<string, number> = {};
  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
  }

  const paidInRange = ordersInRange.filter((o) => PAID_STATUSES.has(o.status));
  const revenueInRange = paidInRange.reduce((s, o) => s + o.total, 0);
  const paidOrdersInRange = paidInRange.length;
  const averageOrderValue =
    paidOrdersInRange > 0 ? Math.round(revenueInRange / paidOrdersInRange) : 0;

  const storeViews = eventsInRange.filter((e) => e.eventType === "STORE_VIEW");
  const uniqueVisitors = new Set(
    eventsInRange.map((e) => e.visitorKey).filter(Boolean),
  );

  const conversionRate =
    uniqueVisitors.size > 0
      ? Math.round((ordersInRange.length / uniqueVisitors.size) * 1000) / 10
      : null;

  const buyerCounts = new Map<number, number>();
  for (const o of paidOrders) {
    if (o.buyerUserId == null) continue;
    buyerCounts.set(o.buyerUserId, (buyerCounts.get(o.buyerUserId) ?? 0) + 1);
  }
  const repeatCustomers = [...buyerCounts.values()].filter((c) => c > 1).length;

  const now = new Date();
  const dauSince = new Date(now.getTime() - 86400000);
  const wauSince = new Date(now.getTime() - 7 * 86400000);
  const dauKeys = new Set<string>();
  const wauKeys = new Set<string>();
  for (const e of eventsInRange) {
    if (e.eventType !== "STORE_VIEW") continue;
    if (e.createdAt >= dauSince) dauKeys.add(e.visitorKey);
    if (e.createdAt >= wauSince) wauKeys.add(e.visitorKey);
  }

  const dayMap = new Map<
    string,
    { revenue: number; orders: number; visitors: Set<string> }
  >();
  for (const o of ordersInRange) {
    const key = dayKey(o.createdAt);
    const row = dayMap.get(key) ?? {
      revenue: 0,
      orders: 0,
      visitors: new Set<string>(),
    };
    row.orders += 1;
    if (PAID_STATUSES.has(o.status)) row.revenue += o.total;
    dayMap.set(key, row);
  }
  for (const e of storeViews) {
    const key = dayKey(e.createdAt);
    const row = dayMap.get(key) ?? {
      revenue: 0,
      orders: 0,
      visitors: new Set<string>(),
    };
    row.visitors.add(e.visitorKey);
    dayMap.set(key, row);
  }
  const dailySeries = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({
      day,
      revenue: v.revenue,
      orders: v.orders,
      visitors: v.visitors.size,
    }));

  const skuMap = new Map<
    number,
    { name: string; quantity: number; revenue: number }
  >();
  for (const item of orderItemsInRange) {
    const pid = item.productId;
    if (pid == null) continue;
    const cur = skuMap.get(pid) ?? {
      name: item.name,
      quantity: 0,
      revenue: 0,
    };
    cur.quantity += item.quantity;
    cur.revenue += item.quantity * item.price;
    skuMap.set(pid, cur);
  }
  const topSku = [...skuMap.entries()]
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 10)
    .map(([productId, v]) => ({
      productId,
      name: v.name,
      quantity: v.quantity,
      revenue: v.revenue,
    }));

  const [openTickets, pendingMerchant, resolvedInRange, openReturns] =
    supportCounts;

  return {
    totalOrders: orders.length,
    totalRevenue,
    accepted,
    pending,
    shipped,
    delivered,
    done: shipped + delivered,
    byStatus,
    rangeDays: input.rangeDays,
    rangeSince: since.toISOString(),
    ordersInRange: ordersInRange.length,
    revenueInRange,
    paidOrdersInRange,
    averageOrderValue,
    conversionRate,
    repeatCustomers,
    visitorsInRange: storeViews.length,
    uniqueVisitorsInRange: uniqueVisitors.size,
    dau: dauKeys.size,
    wau: wauKeys.size,
    dailySeries,
    topSku,
    support: {
      openTickets,
      pendingMerchant,
      resolvedInRange,
      openReturns,
    },
  };
}
