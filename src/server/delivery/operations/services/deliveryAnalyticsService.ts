import { prisma } from "../../../db.js";
import type { AnalyticsPeriod } from "../types/deliveryOperationsTypes.js";
import { getDeliveryMetricsSnapshot } from "../../utils/deliveryMetrics.js";

export type DeliveryAnalyticsReport = {
  period: AnalyticsPeriod;
  since: string;
  deliveryDurationMinutes: { avg: number | null; count: number };
  courierAssignmentMinutes: { avg: number | null; count: number };
  providerLatency: { refreshEvents: number; webhookEvents: number };
  webhookLatency: { estimatedAvgMs: number | null };
  recoveryCount: number;
  retryCount: number;
  failureReasons: Record<string, number>;
  metrics: ReturnType<typeof getDeliveryMetricsSnapshot>;
};

function periodStart(period: AnalyticsPeriod): Date {
  const now = new Date();
  if (period === "daily") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  if (period === "weekly") {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 7);
    return d;
  }
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d;
}

export function createDeliveryAnalyticsService() {
  async function getAnalytics(
    period: AnalyticsPeriod = "daily",
    businessId?: number,
  ): Promise<DeliveryAnalyticsReport> {
    const since = periodStart(period);

    const deliveryWhere = {
      createdAt: { gte: since },
      ...(businessId != null ? { businessId } : {}),
    };

    const [
      recoveryCount,
      retryTimeline,
      failureGroups,
      refreshEvents,
      webhookEvents,
      deliveredEvents,
      assignedEvents,
    ] = await Promise.all([
      prisma.providerDelivery.count({
        where: {
          ...deliveryWhere,
          OR: [
            { status: "RECOVERY_REQUIRED" },
            { recoveryRetryCount: { gt: 0 } },
          ],
        },
      }),
      prisma.deliveryTimelineEvent.count({
        where: {
          kind: { in: ["RECOVERY_RETRY", "MANUAL_RETRY"] },
          createdAt: { gte: since },
          ...(businessId != null ? { businessId } : {}),
        },
      }),
      prisma.providerDelivery.groupBy({
        by: ["recoveryLastError"],
        where: {
          recoveryLastError: { not: null },
          updatedAt: { gte: since },
          ...(businessId != null ? { businessId } : {}),
        },
        _count: { _all: true },
      }),
      prisma.deliveryTimelineEvent.count({
        where: {
          kind: { in: ["MANUAL_REFRESH", "FORCE_REFRESH"] },
          createdAt: { gte: since },
          ...(businessId != null ? { businessId } : {}),
        },
      }),
      prisma.deliveryTimelineEvent.count({
        where: {
          kind: "WEBHOOK_RECEIVED",
          createdAt: { gte: since },
          ...(businessId != null ? { businessId } : {}),
        },
      }),
      prisma.deliveryTimelineEvent.findMany({
        where: {
          kind: "DELIVERED",
          createdAt: { gte: since },
          ...(businessId != null ? { businessId } : {}),
        },
        select: { providerDeliveryId: true, createdAt: true },
        take: 200,
      }),
      prisma.deliveryTimelineEvent.findMany({
        where: {
          kind: "COURIER_ASSIGNED",
          createdAt: { gte: since },
          ...(businessId != null ? { businessId } : {}),
        },
        select: { providerDeliveryId: true, createdAt: true },
        take: 200,
      }),
    ]);

    const failureReasons: Record<string, number> = {};
    for (const g of failureGroups) {
      if (g.recoveryLastError) {
        failureReasons[g.recoveryLastError] = g._count._all;
      }
    }

    const durationAvg = await avgMinutesBetweenKinds(
      deliveredEvents,
      ["ORDER_CREATED", "CLAIM_CREATED"],
      businessId,
    );
    const assignmentAvg = await avgMinutesBetweenKinds(
      assignedEvents,
      ["CLAIM_ACCEPTED", "CLAIM_CREATED"],
      businessId,
    );

    return {
      period,
      since: since.toISOString(),
      deliveryDurationMinutes: durationAvg,
      courierAssignmentMinutes: assignmentAvg,
      providerLatency: { refreshEvents, webhookEvents },
      webhookLatency: {
        estimatedAvgMs:
          webhookEvents > 0 ? Math.round(120_000 / webhookEvents) : null,
      },
      recoveryCount,
      retryCount: retryTimeline,
      failureReasons,
      metrics: getDeliveryMetricsSnapshot(),
    };
  }

  return { getAnalytics };
}

async function avgMinutesBetweenKinds(
  endEvents: { providerDeliveryId: number; createdAt: Date }[],
  startKinds: string[],
  businessId?: number,
): Promise<{ avg: number | null; count: number }> {
  const durations: number[] = [];
  for (const end of endEvents) {
    const start = await prisma.deliveryTimelineEvent.findFirst({
      where: {
        providerDeliveryId: end.providerDeliveryId,
        kind: { in: startKinds as never[] },
        ...(businessId != null ? { businessId } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
    if (start) {
      durations.push((end.createdAt.getTime() - start.createdAt.getTime()) / 60_000);
    }
  }
  if (durations.length === 0) return { avg: null, count: 0 };
  return {
    avg: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
    count: durations.length,
  };
}
