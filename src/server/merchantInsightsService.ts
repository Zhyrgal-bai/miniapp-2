import type { OrderStatus } from "@prisma/client";
import { buildMerchantAnalytics } from "./merchantAnalyticsService.js";
import { prisma } from "./db.js";
import { isFinikCredentialsReady } from "../shared/finikReady.js";

export type MerchantInsightSeverity = "info" | "success" | "warning";

export type MerchantInsight = {
  code: string;
  severity: MerchantInsightSeverity;
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
};

export type MerchantInsightsPayload = {
  rangeDays: 7 | 30 | 90;
  insights: MerchantInsight[];
  generatedAt: string;
};

const PAID: OrderStatus[] = ["CONFIRMED", "SHIPPED", "DELIVERED"];

export async function buildMerchantInsights(input: {
  businessId: number;
  rangeDays: 7 | 30 | 90;
}): Promise<MerchantInsightsPayload> {
  const bid = input.businessId;
  const rangeDays = input.rangeDays;
  const analytics = await buildMerchantAnalytics({ businessId: bid, rangeDays });
  const insights: MerchantInsight[] = [];

  const conv = analytics.conversionRate;
  const visitors = analytics.uniqueVisitorsInRange ?? 0;
  if (conv != null && visitors >= 20 && conv < 2) {
    insights.push({
      code: "conversion.low",
      severity: "warning",
      title: "Низкая конверсия",
      body: `Конверсия ${conv}% при ${visitors} посетителях за ${rangeDays} дн. Проверьте цены, фото и оформление checkout.`,
      actionLabel: "Дизайн витрины",
      actionHref: "/admin/design",
    });
  } else if (conv != null && conv >= 8 && visitors >= 10) {
    insights.push({
      code: "conversion.good",
      severity: "success",
      title: "Хорошая конверсия",
      body: `Конверсия ${conv}% — выше среднего. Можно масштабировать промо и рекомендации.`,
    });
  }

  const prevSince = new Date(Date.now() - rangeDays * 2 * 86400000);
  const prevUntil = new Date(Date.now() - rangeDays * 86400000);
  const [prevOrders, productCount, weakProducts] = await Promise.all([
    prisma.order.findMany({
      where: {
        businessId: bid,
        createdAt: { gte: prevSince, lt: prevUntil },
        status: { in: PAID },
      },
      select: { total: true },
    }),
    prisma.product.count({ where: { businessId: bid } }),
    (async () => {
      const products = await prisma.product.findMany({
        where: { businessId: bid },
        select: { id: true },
      });
      if (products.length === 0) return 0;
      const soldIds = await prisma.orderItem.findMany({
        where: {
          businessId: bid,
          productId: { in: products.map((p) => p.id) },
          order: { status: { in: PAID } },
        },
        select: { productId: true },
        distinct: ["productId"],
      });
      const soldSet = new Set(
        soldIds.map((r) => r.productId).filter((id): id is number => id != null),
      );
      return products.filter((p) => !soldSet.has(p.id)).length;
    })(),
  ]);
  const prevRevenue = prevOrders.reduce((s, o) => s + o.total, 0);
  const curRevenue = analytics.revenueInRange ?? 0;
  if (prevRevenue > 0 && curRevenue < prevRevenue * 0.5) {
    insights.push({
      code: "revenue.drop",
      severity: "warning",
      title: "Падение выручки",
      body: `Выручка за период ${curRevenue} сом — менее половины предыдущего (${prevRevenue} сом).`,
      actionLabel: "Заказы",
      actionHref: "/admin/orders",
    });
  }

  const pendingMerchant = analytics.support?.pendingMerchant ?? 0;
  if (pendingMerchant >= 3) {
    insights.push({
      code: "support.backlog",
      severity: "warning",
      title: "Очередь поддержки",
      body: `${pendingMerchant} тикетов ждут ответа мерчанта.`,
      actionLabel: "Поддержка",
      actionHref: "/admin/support",
    });
  }

  if (productCount < 5) {
    insights.push({
      code: "catalog.thin",
      severity: "info",
      title: "Мало товаров",
      body: `В каталоге ${productCount} позиций. Добавьте больше SKU для лучшей конверсии.`,
      actionLabel: "Товары",
      actionHref: "/admin/products",
    });
  }

  if (weakProducts > 0 && productCount >= 5) {
    insights.push({
      code: "product.weak",
      severity: "info",
      title: "Товары без продаж",
      body: `${weakProducts} товаров ещё не продавались. Обновите фото или описания.`,
      actionLabel: "Товары",
      actionHref: "/admin/products",
    });
  }

  const biz = await prisma.business.findUnique({
    where: { id: bid },
    select: {
      finikApiKey: true,
      finikAccountId: true,
      storefrontPublishedAt: true,
      categories: { select: { id: true }, take: 1 },
    },
  });
  if (biz && !isFinikCredentialsReady(biz.finikApiKey, biz.finikAccountId)) {
    insights.push({
      code: "onboarding.finik",
      severity: "info",
      title: "Нет оплаты Finik",
      body: "Подключите Finik, чтобы принимать оплату в витрине.",
      actionLabel: "Настройки",
      actionHref: "/admin/settings",
    });
  }
  if (biz && !biz.storefrontPublishedAt) {
    insights.push({
      code: "onboarding.publish",
      severity: "info",
      title: "Витрина не опубликована",
      body: "Опубликуйте витрину, чтобы покупатели видели магазин.",
      actionLabel: "Дизайн",
      actionHref: "/admin/design",
    });
  }
  if (biz && biz.categories.length === 0) {
    insights.push({
      code: "onboarding.categories",
      severity: "info",
      title: "Нет категорий",
      body: "Создайте категории для навигации и рекомендаций.",
      actionLabel: "Категории",
      actionHref: "/admin/categories",
    });
  }

  const top = analytics.topSku?.[0];
  if (top && top.quantity >= 3) {
    insights.push({
      code: "product.top",
      severity: "success",
      title: "Лидер продаж",
      body: `«${top.name}» — ${top.quantity} шт. за период. Рассмотрите upsell рядом с этим товаром.`,
    });
  }

  return {
    rangeDays,
    insights,
    generatedAt: new Date().toISOString(),
  };
}
