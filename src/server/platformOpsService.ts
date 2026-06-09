import { prisma } from "./db.js";
import { SubscriptionStatus } from "@prisma/client";
import { canAcceptCustomerOrders } from "./subscriptionAccess.js";
import { ORDER_ANALYTICS_SUCCESS_STATUSES_DB } from "../shared/orderAnalytics.js";

export type PlatformOpsSummary = {
  generatedAt: string;
  stores: {
    active: number;
    blocked: number;
    subscriptionExpired: number;
    quotaExhausted: number;
    quotaNearLimit: number;
    quotaHealthy: number;
    finikNotConfigured: number;
  };
  orders: {
    last24h: number;
    unpaidPending: number;
    unpaidStaleOver1h: number;
    cancelledLast24h: number;
    confirmedLast24h: number;
  };
  support: {
    pendingCancelRequests: number;
    pendingRefundRequests: number;
    pendingReturnRequests: number;
  };
  /** Phase 15: additive platform-wide customer activity (distinct paying buyers). */
  customers: {
    payingBuyers: number;
    returningBuyers: number;
  };
  /** Phase 16: additive platform-wide marketing activity (aggregate only). */
  marketing: {
    activePromotions: number;
    activeCampaigns: number;
    loyaltyPrograms: number;
  };
  /** Phase 17: additive web-experience readiness (aggregate only, no PII). */
  website: {
    publishedStorefronts: number;
    customSlugs: number;
    missingSlug: number;
    withWebProfile: number;
  };
  onboarding: {
    pendingRegistrationRequests: number;
  };
  alerts: string[];
};

/** Lightweight operator dashboard metrics — no PII. */
export async function buildPlatformOpsSummary(): Promise<PlatformOpsSummary> {
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const staleCutoff = new Date(now.getTime() - 60 * 60 * 1000);

  const [
    activeStores,
    blockedStores,
    quotaExhaustedStores,
    businesses,
    ordersLast24h,
    unpaidPending,
    unpaidStale,
    cancelledLast24h,
    confirmedLast24h,
    pendingCancel,
    pendingRefund,
    pendingReturn,
    pendingRegistration,
    buyerGroups,
  ] = await Promise.all([
    prisma.business.count({
      where: { isActive: true, isBlocked: false },
    }),
    prisma.business.count({ where: { isBlocked: true } }),
    prisma.business.count({
      where: { subscriptionStatus: SubscriptionStatus.QUOTA_EXHAUSTED },
    }),
    prisma.business.findMany({
      where: { isActive: true, isBlocked: false },
      select: {
        isActive: true,
        isBlocked: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
        gracePeriodEndsAt: true,
        freeOrdersUsed: true,
        freeOrdersLimit: true,
        finikApiKey: true,
        finikAccountId: true,
      },
    }),
    prisma.order.count({ where: { createdAt: { gte: since24h } } }),
    prisma.order.count({
      where: { status: { in: ["NEW", "ACCEPTED", "PAID_PENDING"] } },
    }),
    prisma.order.count({
      where: {
        status: { in: ["NEW", "ACCEPTED", "PAID_PENDING"] },
        createdAt: { lt: staleCutoff },
      },
    }),
    prisma.order.count({
      where: {
        status: "CANCELLED",
        updatedAt: { gte: since24h },
      },
    }),
    prisma.order.count({
      where: {
        status: { in: [...ORDER_ANALYTICS_SUCCESS_STATUSES_DB] },
        updatedAt: { gte: since24h },
      },
    }),
    prisma.cancelRequest.count({ where: { status: "PENDING" } }),
    prisma.refundRequest.count({
      where: { status: { in: ["REQUESTED", "REVIEWING"] } },
    }),
    prisma.returnRequest.count({ where: { status: "PENDING" } }),
    prisma.registrationRequest.count({ where: { status: "PENDING" } }),
    prisma.order.groupBy({
      by: ["buyerUserId"],
      where: {
        buyerUserId: { not: null },
        status: { in: [...ORDER_ANALYTICS_SUCCESS_STATUSES_DB] },
      },
      _count: { _all: true },
    }),
  ]);

  const payingBuyers = buyerGroups.length;
  const returningBuyers = buyerGroups.filter(
    (g) => (g._count?._all ?? 0) > 1,
  ).length;

  // Phase 16: aggregate marketing activity across tenants (no PII).
  const opsDb = prisma as any;
  const [activePromotions, activeCampaigns, loyaltyPrograms] = await Promise.all([
    opsDb.merchantPromotion.count({ where: { active: true } }).catch(() => 0),
    opsDb.merchantCampaign.count({ where: { active: true, paused: false } }).catch(() => 0),
    opsDb.loyaltyProgram.count({ where: { enabled: true } }).catch(() => 0),
  ]);

  // Phase 17: aggregate web-experience readiness across tenants (no PII).
  const [publishedStorefronts, customSlugs, missingSlug, businessesForWebProfile] =
    await Promise.all([
      prisma.business.count({ where: { storefrontPublishedAt: { not: null } } }).catch(() => 0),
      prisma.business.count({ where: { slug: { not: null } } }).catch(() => 0),
      prisma.business.count({ where: { slug: null } }).catch(() => 0),
      prisma.business
        .findMany({ select: { merchantConfig: true } })
        .catch(() => [] as Array<{ merchantConfig: unknown }>),
    ]);
  const withWebProfile = (businessesForWebProfile as Array<{ merchantConfig: unknown }>).filter(
    (b) => {
      const cfg = b.merchantConfig;
      return (
        cfg != null &&
        typeof cfg === "object" &&
        !Array.isArray(cfg) &&
        (cfg as Record<string, unknown>).webProfile != null
      );
    },
  ).length;

  let subscriptionExpired = 0;
  let finikNotConfigured = 0;
  let quotaNearLimit = 0;
  let quotaHealthy = 0;
  for (const b of businesses) {
    if (!canAcceptCustomerOrders(b, now)) subscriptionExpired += 1;
    const finikOk =
      Boolean(b.finikApiKey?.trim()) && Boolean(b.finikAccountId?.trim());
    if (!finikOk) finikNotConfigured += 1;
    const remaining = Math.max(0, Number(b.freeOrdersLimit ?? 5) - Number(b.freeOrdersUsed ?? 0));
    if (String(b.subscriptionStatus) === "FREE" && remaining <= 1) quotaNearLimit += 1;
    if (String(b.subscriptionStatus) === "FREE" && remaining > 1) quotaHealthy += 1;
  }

  const alerts: string[] = [];
  if (unpaidStale > 0) {
    alerts.push(`unpaid_orders_stale:${unpaidStale}`);
  }
  if (pendingCancel + pendingRefund + pendingReturn > 20) {
    alerts.push("support_queue_high");
  }
  if (subscriptionExpired > 0) {
    alerts.push(`stores_subscription_expired:${subscriptionExpired}`);
  }
  if (quotaExhaustedStores > 0) {
    alerts.push(`stores_quota_exhausted:${quotaExhaustedStores}`);
  }
  if (quotaNearLimit > 0) {
    alerts.push(`stores_quota_near_limit:${quotaNearLimit}`);
  }

  return {
    generatedAt: now.toISOString(),
    stores: {
      active: activeStores,
      blocked: blockedStores,
      subscriptionExpired,
      quotaExhausted: quotaExhaustedStores,
      quotaNearLimit,
      quotaHealthy,
      finikNotConfigured,
    },
    orders: {
      last24h: ordersLast24h,
      unpaidPending,
      unpaidStaleOver1h: unpaidStale,
      cancelledLast24h,
      confirmedLast24h,
    },
    support: {
      pendingCancelRequests: pendingCancel,
      pendingRefundRequests: pendingRefund,
      pendingReturnRequests: pendingReturn,
    },
    customers: {
      payingBuyers,
      returningBuyers,
    },
    marketing: {
      activePromotions: Number(activePromotions) || 0,
      activeCampaigns: Number(activeCampaigns) || 0,
      loyaltyPrograms: Number(loyaltyPrograms) || 0,
    },
    website: {
      publishedStorefronts: Number(publishedStorefronts) || 0,
      customSlugs: Number(customSlugs) || 0,
      missingSlug: Number(missingSlug) || 0,
      withWebProfile,
    },
    onboarding: {
      pendingRegistrationRequests: pendingRegistration,
    },
    alerts,
  };
}
