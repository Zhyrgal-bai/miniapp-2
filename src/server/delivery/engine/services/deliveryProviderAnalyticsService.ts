import { prisma } from "../../../db.js";
import { getProviderHealthMetrics } from "../ProviderHealthService.js";
import { listDeliveryEnginePlugins } from "../ProviderRegistry.js";

export type ProviderAnalyticsRow = {
  providerId: string;
  displayName: string;
  deliveryCount: number;
  completed: number;
  cancelled: number;
  recovery: number;
  failures: number;
  averagePrice: number | null;
  averageEtaMinutes: number | null;
  revenue: number;
  health: ReturnType<typeof getProviderHealthMetrics>;
};

export type ProviderAnalyticsReport = {
  period: "daily" | "weekly" | "monthly";
  since: string;
  providers: ProviderAnalyticsRow[];
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

export function createDeliveryProviderAnalyticsService() {
  async function getAnalytics(
    period: "daily" | "weekly" | "monthly" = "daily",
    businessId?: number,
  ): Promise<ProviderAnalyticsReport> {
    const since = periodStart(period);
    const plugins = listDeliveryEnginePlugins();
    const rows: ProviderAnalyticsRow[] = [];

    for (const plugin of plugins) {
      const where = {
        provider: plugin.providerId,
        createdAt: { gte: since },
        ...(businessId != null ? { businessId } : {}),
      };

      const [total, completed, cancelled, recovery, failed, agg] = await Promise.all([
        prisma.providerDelivery.count({ where }),
        prisma.providerDelivery.count({ where: { ...where, status: "DELIVERED" } }),
        prisma.providerDelivery.count({ where: { ...where, status: "CANCELLED" } }),
        prisma.providerDelivery.count({
          where: {
            ...where,
            OR: [{ status: "RECOVERY_REQUIRED" }, { recoveryRetryCount: { gt: 0 } }],
          },
        }),
        prisma.providerDelivery.count({
          where: { ...where, status: { in: ["FAILED", "RECOVERY_REQUIRED"] } },
        }),
        prisma.providerDelivery.aggregate({
          where,
          _avg: { price: true, etaMinutes: true },
          _sum: { price: true },
        }),
      ]);

      rows.push({
        providerId: plugin.providerId,
        displayName: plugin.displayName,
        deliveryCount: total,
        completed,
        cancelled,
        recovery,
        failures: failed,
        averagePrice: agg._avg.price != null ? Math.round(agg._avg.price) : null,
        averageEtaMinutes:
          agg._avg.etaMinutes != null ? Math.round(agg._avg.etaMinutes) : null,
        revenue: agg._sum.price ?? 0,
        health: getProviderHealthMetrics(plugin.providerId),
      });
    }

    rows.sort((a, b) => b.deliveryCount - a.deliveryCount);

    return { period, since: since.toISOString(), providers: rows };
  }

  return { getAnalytics };
}

export type OperatorProviderDashboardRow = ProviderAnalyticsRow & {
  ranking: number;
  requests: number;
  errors: number;
};

export function createOperatorProviderDashboardService() {
  const analytics = createDeliveryProviderAnalyticsService();

  async function getDashboard(
    period: "daily" | "weekly" | "monthly" = "daily",
  ): Promise<{ providers: OperatorProviderDashboardRow[] }> {
    const report = await analytics.getAnalytics(period);
    const providers = report.providers.map((row, index) => ({
      ...row,
      ranking: index + 1,
      requests: row.health.totalRequests,
      errors: Math.round(row.health.failureRate * row.health.totalRequests),
    }));
    return { providers };
  }

  return { getDashboard };
}
