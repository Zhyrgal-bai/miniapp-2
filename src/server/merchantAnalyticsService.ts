import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { isOrderAnalyticsSuccessStatus } from "../shared/orderAnalytics.js";
import { getMerchantLifetimeAnalytics } from "./merchantLifetimeAnalyticsService.js";

type PeriodFunnel = {
  created: number;
  paid: number;
  completed: number;
  cancelled: number;
  paidRate: number;
  completedRate: number;
  cancelledRate: number;
};

type PeriodKpi = {
  orders: number;
  revenue: number;
  averageOrderValue: number;
  funnel: PeriodFunnel;
};

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
  topCategories: Array<{
    categoryId: number | null;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  periods: {
    today: PeriodKpi;
    week: PeriodKpi;
    month: PeriodKpi;
    lifetime: PeriodKpi;
  };
  freeOrdersUsed: number;
  freeOrdersRemaining: number;
  subscriptionConversionRate: number | null;
  /** Phase 15: additive customer-health snapshot (no contract removals). */
  customers: {
    total: number;
    new: number;
    returning: number;
    repeatPurchaseRate: number;
    averageOrdersPerCustomer: number;
  };
  /** Phase 16: additive marketing-health snapshot (aggregate only). */
  marketing: {
    activePromotions: number;
    totalPromotions: number;
    activeCampaigns: number;
    totalCampaigns: number;
    promotionRedemptions: number;
    loyaltyEnabled: boolean;
    loyaltyMembers: number;
  };
  support: {
    openTickets: number;
    pendingMerchant: number;
    resolvedInRange: number;
    openReturns: number;
  };
  operations: {
    cancelledOrders: number;
    cancelledInRange: number;
    refundRequestsInRange: number;
    returnRequestsInRange: number;
    lowStockSkus: number;
  };
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Active = flagged active and within optional schedule window. */
function isMarketingActive(
  row: { active?: boolean; startsAt?: Date | null; endsAt?: Date | null },
  now: Date,
): boolean {
  if (row.active !== true) return false;
  const t = now.getTime();
  if (row.startsAt != null && t < row.startsAt.getTime()) return false;
  if (row.endsAt != null && t > row.endsAt.getTime()) return false;
  return true;
}

function toPeriodFunnel(orders: Array<{ status: string }>): PeriodFunnel {
  const created = orders.length;
  const paid = orders.filter((o) => isOrderAnalyticsSuccessStatus(o.status)).length;
  const completed = orders.filter((o) => o.status === "DELIVERED").length;
  const cancelled = orders.filter((o) => o.status === "CANCELLED").length;
  const denom = Math.max(created, 1);
  const toPct = (value: number) => Math.round((value / denom) * 1000) / 10;
  return {
    created,
    paid,
    completed,
    cancelled,
    paidRate: toPct(paid),
    completedRate: toPct(completed),
    cancelledRate: toPct(cancelled),
  };
}

function toPeriodKpi(
  orders: Array<{ status: string; total: number }>,
  revenueOverride?: number,
): PeriodKpi {
  const paidOrders = orders.filter((o) => isOrderAnalyticsSuccessStatus(o.status));
  const revenue =
    revenueOverride ?? paidOrders.reduce((sum, order) => sum + order.total, 0);
  const averageOrderValue =
    paidOrders.length > 0 ? Math.round(revenue / paidOrders.length) : 0;
  return {
    orders: paidOrders.length,
    revenue,
    averageOrderValue,
    funnel: toPeriodFunnel(orders),
  };
}

export async function buildMerchantAnalytics(input: {
  businessId: number;
  rangeDays: 7 | 30 | 90;
}): Promise<MerchantAnalyticsPayload> {
  const since = new Date(Date.now() - input.rangeDays * 86400000);
  const bid = input.businessId;

  const [orders, ordersInRange, eventsInRange, orderItemsInRange, supportCounts, opsCounts, business, lifetime] =
    await Promise.all([
      prisma.order.findMany({
        where: { businessId: bid },
        select: {
          id: true,
          status: true,
          total: true,
          buyerUserId: true,
          createdAt: true,
        },
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
          order: {
            createdAt: { gte: since },
            status: { in: ["CONFIRMED", "SHIPPED", "DELIVERED"] },
          },
        },
        select: {
          productId: true,
          name: true,
          quantity: true,
          price: true,
          product: {
            select: {
              categoryId: true,
              category: { select: { name: true } },
            },
          },
        },
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
      Promise.all([
        prisma.order.count({
          where: { businessId: bid, status: "CANCELLED" },
        }),
        prisma.order.count({
          where: {
            businessId: bid,
            status: "CANCELLED",
            updatedAt: { gte: since },
          },
        }),
        prisma.refundRequest.count({
          where: { businessId: bid, createdAt: { gte: since } },
        }),
        prisma.returnRequest.count({
          where: { businessId: bid, createdAt: { gte: since } },
        }),
        prisma.productStock.count({
          where: { businessId: bid, available: { lte: 3, gt: 0 } },
        }),
      ]),
      prisma.business.findUnique({
        where: { id: bid },
        select: {
          freeOrdersUsed: true,
          freeOrdersLimit: true,
          subscriptionStatus: true,
        },
      }),
      getMerchantLifetimeAnalytics(bid),
    ]);

  const paidOrders = orders.filter((o) => isOrderAnalyticsSuccessStatus(o.status));
  const computedLifetimeRevenue = paidOrders.reduce((s, o) => s + o.total, 0);
  const lifetimeSuccessfulOrders = Math.max(lifetime.successfulOrders, paidOrders.length);
  const totalRevenue = Math.max(lifetime.successfulRevenue, computedLifetimeRevenue);
  const accepted = orders.filter((o) => o.status === "ACCEPTED").length;
  const pending = orders.filter((o) => o.status === "PAID_PENDING").length;
  const shipped = orders.filter((o) => o.status === "SHIPPED").length;
  const delivered = orders.filter((o) => o.status === "DELIVERED").length;

  const byStatus: Record<string, number> = {};
  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
  }

  const paidInRange = ordersInRange.filter((o) => isOrderAnalyticsSuccessStatus(o.status));
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

  const now = new Date();
  const todaySince = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekSince = new Date(now.getTime() - 7 * 86400000);
  const monthSince = new Date(now.getTime() - 30 * 86400000);
  const todayOrders = orders.filter((o) => o.createdAt >= todaySince);
  const weekOrders = orders.filter((o) => o.createdAt >= weekSince);
  const monthOrders = orders.filter((o) => o.createdAt >= monthSince);
  const periods = {
    today: toPeriodKpi(todayOrders),
    week: toPeriodKpi(weekOrders),
    month: toPeriodKpi(monthOrders),
    lifetime: toPeriodKpi(orders, totalRevenue),
  };

  const buyerCounts = new Map<number, number>();
  for (const o of paidOrders) {
    if (o.buyerUserId == null) continue;
    buyerCounts.set(o.buyerUserId, (buyerCounts.get(o.buyerUserId) ?? 0) + 1);
  }
  const repeatCustomers = [...buyerCounts.values()].filter((c) => c > 1).length;

  // Phase 15: additive customer-health snapshot (distinct buyers across orders).
  const buyerFirstOrder = new Map<number, number>();
  for (const o of orders) {
    if (o.buyerUserId == null) continue;
    const t = o.createdAt.getTime();
    const prev = buyerFirstOrder.get(o.buyerUserId);
    if (prev == null || t < prev) buyerFirstOrder.set(o.buyerUserId, t);
  }
  const totalCustomers = buyerFirstOrder.size;
  const newCustomers = [...buyerFirstOrder.values()].filter(
    (t) => t >= since.getTime(),
  ).length;
  const buyersWithPaid = buyerCounts.size;
  const totalPaidByBuyers = [...buyerCounts.values()].reduce((s, c) => s + c, 0);
  const customerHealth = {
    total: totalCustomers,
    new: newCustomers,
    returning: repeatCustomers,
    repeatPurchaseRate:
      buyersWithPaid > 0
        ? Math.round((repeatCustomers / buyersWithPaid) * 1000) / 10
        : 0,
    averageOrdersPerCustomer:
      buyersWithPaid > 0
        ? Math.round((totalPaidByBuyers / buyersWithPaid) * 10) / 10
        : 0,
  };

  // Phase 16: additive marketing-health snapshot (aggregate, no PII).
  const marketingDb = prisma as any;
  const [promotionRows, campaignRows, loyaltyRow, loyaltyMembers] = await Promise.all([
    marketingDb.merchantPromotion.findMany({
      where: { businessId: bid },
      select: { active: true, startsAt: true, endsAt: true, maxRedemptions: true, redemptions: true },
    }).catch(() => [] as any[]),
    marketingDb.merchantCampaign.findMany({
      where: { businessId: bid },
      select: { active: true, paused: true, startsAt: true, endsAt: true },
    }).catch(() => [] as any[]),
    marketingDb.loyaltyProgram.findUnique({
      where: { businessId: bid },
      select: { enabled: true },
    }).catch(() => null),
    marketingDb.customerLoyaltyState.count({ where: { businessId: bid } }).catch(() => 0),
  ]);

  const promotionRedemptions = (promotionRows as any[]).reduce(
    (s, p) => s + (Number(p.redemptions) || 0),
    0,
  );
  const activePromotions = (promotionRows as any[]).filter((p) =>
    isMarketingActive(p, now),
  ).length;
  const activeCampaigns = (campaignRows as any[]).filter((c) =>
    c.active === true && c.paused !== true && isMarketingActive(c, now),
  ).length;
  const marketingHealth = {
    activePromotions,
    totalPromotions: (promotionRows as any[]).length,
    activeCampaigns,
    totalCampaigns: (campaignRows as any[]).length,
    promotionRedemptions,
    loyaltyEnabled: (loyaltyRow as any)?.enabled === true,
    loyaltyMembers: Number(loyaltyMembers) || 0,
  };

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
    if (isOrderAnalyticsSuccessStatus(o.status)) row.revenue += o.total;
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

  const categoryMap = new Map<
    number,
    { name: string; quantity: number; revenue: number }
  >();
  for (const item of orderItemsInRange) {
    const categoryId = item.product?.categoryId;
    if (categoryId == null) continue;
    const categoryName = item.product?.category?.name ?? "Без категории";
    const current = categoryMap.get(categoryId) ?? {
      name: categoryName,
      quantity: 0,
      revenue: 0,
    };
    current.quantity += item.quantity;
    current.revenue += item.quantity * item.price;
    categoryMap.set(categoryId, current);
  }
  const topCategories = [...categoryMap.entries()]
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 10)
    .map(([categoryId, row]) => ({
      categoryId,
      name: row.name,
      quantity: row.quantity,
      revenue: row.revenue,
    }));

  const [openTickets, pendingMerchant, resolvedInRange, openReturns] =
    supportCounts;
  const [
    cancelledOrders,
    cancelledInRange,
    refundRequestsInRange,
    returnRequestsInRange,
    lowStockSkus,
  ] = opsCounts;
  const freeOrdersUsed = Number(business?.freeOrdersUsed ?? 0);
  const freeOrdersLimit = Number(business?.freeOrdersLimit ?? 5);
  const freeOrdersRemaining = Math.max(0, freeOrdersLimit - freeOrdersUsed);
  const subscriptionConversionRate =
    freeOrdersUsed > 0
      ? ["ACTIVE", "EXPIRING", "PAST_DUE", "GRACE"].includes(
          String(business?.subscriptionStatus ?? ""),
        )
        ? 100
        : 0
      : null;

  return {
    totalOrders: lifetimeSuccessfulOrders,
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
    topCategories,
    periods,
    freeOrdersUsed,
    freeOrdersRemaining,
    subscriptionConversionRate,
    customers: customerHealth,
    marketing: marketingHealth,
    support: {
      openTickets,
      pendingMerchant,
      resolvedInRange,
      openReturns,
    },
    operations: {
      cancelledOrders,
      cancelledInRange,
      refundRequestsInRange,
      returnRequestsInRange,
      lowStockSkus,
    },
  };
}
