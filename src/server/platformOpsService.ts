import { prisma } from "./db.js";
import { isSubscriptionFullyExpired } from "./subscriptionMaintenance.js";

export type PlatformOpsSummary = {
  generatedAt: string;
  stores: {
    active: number;
    blocked: number;
    subscriptionExpired: number;
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
  ] = await Promise.all([
    prisma.business.count({
      where: { isActive: true, isBlocked: false },
    }),
    prisma.business.count({ where: { isBlocked: true } }),
    prisma.business.findMany({
      where: { isActive: true, isBlocked: false },
      select: {
        trialEndsAt: true,
        subscriptionEndsAt: true,
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
        status: { in: ["CONFIRMED", "SHIPPED", "DELIVERED"] },
        updatedAt: { gte: since24h },
      },
    }),
    prisma.cancelRequest.count({ where: { status: "PENDING" } }),
    prisma.refundRequest.count({
      where: { status: { in: ["REQUESTED", "REVIEWING"] } },
    }),
    prisma.returnRequest.count({ where: { status: "PENDING" } }),
    prisma.registrationRequest.count({ where: { status: "PENDING" } }),
  ]);

  let subscriptionExpired = 0;
  let finikNotConfigured = 0;
  for (const b of businesses) {
    if (isSubscriptionFullyExpired(b, now)) subscriptionExpired += 1;
    const finikOk =
      Boolean(b.finikApiKey?.trim()) && Boolean(b.finikAccountId?.trim());
    if (!finikOk) finikNotConfigured += 1;
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

  return {
    generatedAt: now.toISOString(),
    stores: {
      active: activeStores,
      blocked: blockedStores,
      subscriptionExpired,
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
    onboarding: {
      pendingRegistrationRequests: pendingRegistration,
    },
    alerts,
  };
}
