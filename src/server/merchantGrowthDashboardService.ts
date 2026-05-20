import { buildMerchantAnalytics } from "./merchantAnalyticsService.js";
import { buildMerchantInsights } from "./merchantInsightsService.js";
import { buildMerchantGrowth } from "./merchantGrowthService.js";
import { assessMerchantRetention } from "./merchantRetentionService.js";
import { referralStats } from "./merchantReferralService.js";
import { prisma } from "./db.js";

export type GrowthMilestone = {
  id: string;
  label: string;
  done: boolean;
  achievedAt: string | null;
};

export type MerchantGrowthDashboardPayload = {
  rangeDays: 7 | 30 | 90;
  growth: Awaited<ReturnType<typeof buildMerchantGrowth>>;
  insights: Awaited<ReturnType<typeof buildMerchantInsights>>;
  retention: Awaited<ReturnType<typeof assessMerchantRetention>>;
  milestones: GrowthMilestone[];
  optimizationTips: string[];
  referral: { signups: number; code: string | null };
  engagement: {
    ordersInRange: number;
    revenueInRange: number;
    conversionRate: number | null;
    uniqueVisitors: number;
  };
};

const PAID = ["CONFIRMED", "SHIPPED", "DELIVERED"] as const;

export async function buildMerchantGrowthDashboard(input: {
  businessId: number;
  rangeDays: 7 | 30 | 90;
}): Promise<MerchantGrowthDashboardPayload> {
  const bid = input.businessId;
  const rangeDays = input.rangeDays;

  const [growth, insights, retention, referral, analytics, orderCount, biz] =
    await Promise.all([
      buildMerchantGrowth(bid),
      buildMerchantInsights({ businessId: bid, rangeDays }),
      assessMerchantRetention(bid),
      referralStats(bid),
      buildMerchantAnalytics({ businessId: bid, rangeDays }),
      prisma.order.count({
        where: { businessId: bid, status: { in: [...PAID] } },
      }),
      prisma.business.findUnique({
        where: { id: bid },
        select: { storefrontPublishedAt: true, createdAt: true },
      }),
    ]);

  const milestones: GrowthMilestone[] = [
    {
      id: "registered",
      label: "Магазин создан",
      done: true,
      achievedAt: biz?.createdAt.toISOString() ?? null,
    },
    {
      id: "published",
      label: "Витрина опубликована",
      done: Boolean(biz?.storefrontPublishedAt),
      achievedAt: biz?.storefrontPublishedAt?.toISOString() ?? null,
    },
    {
      id: "catalog_ready",
      label: "Каталог ≥5 товаров",
      done: growth.checklist.find((c) => c.id === "products")?.done ?? false,
      achievedAt: null,
    },
    {
      id: "first_order",
      label: "Первый заказ",
      done: orderCount >= 1,
      achievedAt: null,
    },
    {
      id: "ten_orders",
      label: "10+ заказов",
      done: orderCount >= 10,
      achievedAt: null,
    },
    {
      id: "growth_ready",
      label: "Готовность 80%+",
      done: growth.score >= Math.round(growth.maxScore * 0.8),
      achievedAt: null,
    },
  ];

  const optimizationTips = [
    ...growth.recommendations.map((r) => `Настройка: ${r}`),
    ...insights.insights
      .filter((i) => i.severity === "warning" || i.severity === "info")
      .slice(0, 2)
      .map((i) => i.title),
    ...retention.nudges,
  ].slice(0, 5);

  return {
    rangeDays,
    growth,
    insights,
    retention,
    milestones,
    optimizationTips,
    referral,
    engagement: {
      ordersInRange: analytics.ordersInRange ?? 0,
      revenueInRange: analytics.revenueInRange ?? 0,
      conversionRate: analytics.conversionRate ?? null,
      uniqueVisitors: analytics.uniqueVisitorsInRange ?? 0,
    },
  };
}
