import { MerchantNotificationKind } from "@prisma/client";
import { prisma } from "./db.js";
import { createMerchantNotification } from "./merchantNotificationsService.js";
import { buildMerchantGrowth } from "./merchantGrowthService.js";

export type RetentionStatus = "active" | "at_risk" | "inactive";

export type MerchantRetentionPayload = {
  status: RetentionStatus;
  nudges: string[];
  daysSinceLastOrder: number | null;
  readinessScore: number;
};

const DEDUPE_HOURS = 72;

async function recentlyNudged(
  businessId: number,
  titlePrefix: string,
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUPE_HOURS * 3600000);
  const n = await prisma.merchantNotification.count({
    where: {
      businessId,
      kind: MerchantNotificationKind.SYSTEM,
      title: { startsWith: titlePrefix },
      createdAt: { gte: since },
    },
  });
  return n > 0;
}

export async function assessMerchantRetention(
  businessId: number,
): Promise<MerchantRetentionPayload> {
  const bid = businessId;
  const [lastOrder, growth] = await Promise.all([
    prisma.order.findFirst({
      where: { businessId: bid },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    buildMerchantGrowth(bid),
  ]);

  const daysSinceLastOrder = lastOrder
    ? Math.floor((Date.now() - lastOrder.createdAt.getTime()) / 86400000)
    : null;

  const nudges: string[] = [];
  let status: RetentionStatus = "active";

  if (growth.score < 50) {
    status = "at_risk";
    nudges.push("Завершите настройку магазина — готовность ниже 50%");
  }
  if (daysSinceLastOrder == null && growth.checklist.find((c) => c.id === "publish")?.done) {
    status = "at_risk";
    nudges.push("Витрина опубликована, но заказов ещё нет — проверьте Finik и промо");
  }
  if (daysSinceLastOrder != null && daysSinceLastOrder >= 14) {
    status = "inactive";
    nudges.push(`Нет заказов ${daysSinceLastOrder} дн. — запустите акцию или обновите каталог`);
  }

  return {
    status,
    nudges: nudges.slice(0, 3),
    daysSinceLastOrder,
    readinessScore: growth.score,
  };
}

/** Rule-based reactivation notifications (fire-and-forget). */
export async function maybeEmitRetentionNudges(businessId: number): Promise<void> {
  try {
    const r = await assessMerchantRetention(businessId);
    if (r.status === "active" || r.nudges.length === 0) return;

    const prefix =
      r.status === "inactive" ? "💤 Нет активности" : "📈 Рост магазина";
    if (await recentlyNudged(businessId, prefix)) return;

    await createMerchantNotification({
      businessId,
      kind: MerchantNotificationKind.SYSTEM,
      title: `${prefix}`,
      body: r.nudges[0] ?? "Проверьте раздел роста в операциях",
      href: "/admin/analytics",
    });
  } catch (e) {
    console.error("[maybeEmitRetentionNudges]", e);
  }
}
