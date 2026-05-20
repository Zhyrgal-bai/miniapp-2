import { MerchantNotificationKind } from "@prisma/client";
import { buildMerchantAnalytics } from "./merchantAnalyticsService.js";
import { createMerchantNotification } from "./merchantNotificationsService.js";
import { prisma } from "./db.js";

const DEDUPE_HOURS = 24;

async function recentlyNotified(
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

/** Rule-based actionable alerts → merchant notification center. Fire-and-forget. */
export async function maybeEmitSmartAlerts(input: {
  businessId: number;
  rangeDays?: 7 | 30 | 90;
}): Promise<void> {
  const bid = input.businessId;
  const rangeDays = input.rangeDays ?? 30;

  try {
    const analytics = await buildMerchantAnalytics({
      businessId: bid,
      rangeDays,
    });

    const conv = analytics.conversionRate;
    const visitors = analytics.uniqueVisitorsInRange ?? 0;
    if (conv != null && visitors >= 20 && conv < 2) {
      const prefix = "⚠ Конверсия";
      if (!(await recentlyNotified(bid, prefix))) {
        await createMerchantNotification({
          businessId: bid,
          kind: MerchantNotificationKind.SYSTEM,
          title: `${prefix}: ${conv}%`,
          body: `${visitors} посетителей за ${rangeDays} дн. — проверьте витрину и checkout.`,
          href: "/admin/analytics",
        });
      }
    }

    const pending = analytics.support?.pendingMerchant ?? 0;
    if (pending >= 3) {
      const prefix = "⚠ Поддержка";
      if (!(await recentlyNotified(bid, prefix))) {
        await createMerchantNotification({
          businessId: bid,
          kind: MerchantNotificationKind.SYSTEM,
          title: `${prefix}: ${pending} тикетов`,
          body: "Клиенты ждут ответа. Откройте раздел поддержки.",
          href: "/admin/support",
        });
      }
    }
  } catch (e) {
    console.error("[maybeEmitSmartAlerts]", e);
  }
}
