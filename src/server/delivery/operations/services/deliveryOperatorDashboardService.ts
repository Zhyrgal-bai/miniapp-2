import type { ProviderDeliveryRepository } from "../../repositories/providerDeliveryRepository.js";
import { createProviderDeliveryRepository } from "../../repositories/providerDeliveryRepository.js";
import { ACTIVE_RECOVERY_STATUSES } from "../../types/providerDeliveryTypes.js";
import { getDeliveryMetricsSnapshot } from "../../utils/deliveryMetrics.js";
import {
  createDeliveryOperationsRepository,
} from "../repositories/deliveryOperationsRepository.js";
import { prisma } from "../../../db.js";

export type OperatorDeliveryDashboard = {
  activeDeliveries: number;
  deliveriesByProvider: Record<string, number>;
  recoveryQueue: number;
  failedDeliveries: number;
  averageEtaMinutes: number | null;
  averageDeliveryDurationMinutes: number | null;
  averageProviderResponseTimeMs: number | null;
  averageCourierAssignmentMinutes: number | null;
  completionPercent: number;
  cancellationPercent: number;
  recoveryPercent: number;
  metrics: ReturnType<typeof getDeliveryMetricsSnapshot>;
};

function periodStart(period: "daily" | "weekly" | "monthly"): Date {
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

export function createDeliveryOperatorDashboardService(deps?: {
  repository?: ProviderDeliveryRepository;
}) {
  const repository = deps?.repository ?? createProviderDeliveryRepository();
  const operationsRepo = createDeliveryOperationsRepository({ providerRepo: repository });

  async function getDashboard(
    period: "daily" | "weekly" | "monthly" = "daily",
  ): Promise<OperatorDeliveryDashboard> {
    const since = periodStart(period);

    const [
      activeDeliveries,
      failedDeliveries,
      recoveryQueue,
      deliveriesByProvider,
      deliveredCount,
      cancelledCount,
      recoveryCount,
      totalInPeriod,
      avgEta,
      durationAgg,
      assignmentAgg,
    ] = await Promise.all([
      repository.countByStatus([...ACTIVE_RECOVERY_STATUSES, "ACCEPTED", "CREATED"]),
      repository.countByStatus(["FAILED", "RECOVERY_REQUIRED"]),
      repository.countByStatus(["RECOVERY_REQUIRED"]),
      operationsRepo.countByProvider(),
      prisma.providerDelivery.count({
        where: { status: "DELIVERED", providerUpdatedAt: { gte: since } },
      }),
      prisma.providerDelivery.count({
        where: { status: "CANCELLED", providerUpdatedAt: { gte: since } },
      }),
      prisma.providerDelivery.count({
        where: {
          OR: [
            { status: "RECOVERY_REQUIRED" },
            { recoveryRetryCount: { gt: 0 } },
          ],
          updatedAt: { gte: since },
        },
      }),
      prisma.providerDelivery.count({ where: { createdAt: { gte: since } } }),
      prisma.providerDelivery.aggregate({
        where: { etaMinutes: { not: null } },
        _avg: { etaMinutes: true },
      }),
      computeAvgDeliveryDurationMinutes(since),
      computeAvgCourierAssignmentMinutes(since),
    ]);

    const denom = Math.max(totalInPeriod, 1);
    const responseAgg = await prisma.deliveryTimelineEvent.aggregate({
      where: {
        kind: { in: ["MANUAL_REFRESH", "WEBHOOK_RECEIVED"] },
        createdAt: { gte: since },
      },
      _count: { _all: true },
    });

    return {
      activeDeliveries,
      deliveriesByProvider,
      recoveryQueue,
      failedDeliveries,
      averageEtaMinutes:
        avgEta._avg.etaMinutes != null ? Math.round(avgEta._avg.etaMinutes) : null,
      averageDeliveryDurationMinutes: durationAgg,
      averageProviderResponseTimeMs:
        responseAgg._count._all > 0 ? Math.round(60_000 / responseAgg._count._all) : null,
      averageCourierAssignmentMinutes: assignmentAgg,
      completionPercent: Math.round((deliveredCount / denom) * 1000) / 10,
      cancellationPercent: Math.round((cancelledCount / denom) * 1000) / 10,
      recoveryPercent: Math.round((recoveryCount / denom) * 1000) / 10,
      metrics: getDeliveryMetricsSnapshot(),
    };
  }

  return { getDashboard };
}

async function computeAvgDeliveryDurationMinutes(since: Date): Promise<number | null> {
  const rows = await prisma.deliveryTimelineEvent.findMany({
    where: { kind: "DELIVERED", createdAt: { gte: since } },
    select: { providerDeliveryId: true, createdAt: true },
    take: 500,
  });
  if (rows.length === 0) return null;

  const durations: number[] = [];
  for (const delivered of rows) {
    const start = await prisma.deliveryTimelineEvent.findFirst({
      where: {
        providerDeliveryId: delivered.providerDeliveryId,
        kind: { in: ["ORDER_CREATED", "CLAIM_CREATED"] },
      },
      orderBy: { createdAt: "asc" },
    });
    if (start) {
      durations.push(
        (delivered.createdAt.getTime() - start.createdAt.getTime()) / 60_000,
      );
    }
  }
  if (durations.length === 0) return null;
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

async function computeAvgCourierAssignmentMinutes(since: Date): Promise<number | null> {
  const assigned = await prisma.deliveryTimelineEvent.findMany({
    where: { kind: "COURIER_ASSIGNED", createdAt: { gte: since } },
    select: { providerDeliveryId: true, createdAt: true },
    take: 500,
  });
  if (assigned.length === 0) return null;

  const durations: number[] = [];
  for (const row of assigned) {
    const start = await prisma.deliveryTimelineEvent.findFirst({
      where: {
        providerDeliveryId: row.providerDeliveryId,
        kind: { in: ["CLAIM_ACCEPTED", "CLAIM_CREATED"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (start) {
      durations.push((row.createdAt.getTime() - start.createdAt.getTime()) / 60_000);
    }
  }
  if (durations.length === 0) return null;
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}
