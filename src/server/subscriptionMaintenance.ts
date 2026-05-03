import { MembershipRole, SubscriptionStatus } from "@prisma/client";
import { prisma } from "./db.js";

/** Calendar-day difference: `later` vs `earlier`. */
function differenceInCalendarDays(later: Date, earlier: Date): number {
  const utcLater = Date.UTC(
    later.getFullYear(),
    later.getMonth(),
    later.getDate(),
  );
  const utcEarlier = Date.UTC(
    earlier.getFullYear(),
    earlier.getMonth(),
    earlier.getDate(),
  );
  return Math.round((utcLater - utcEarlier) / 86400000);
}

/**
 * No valid paid window and no valid trial window → fully expired (auto-deactivate).
 */
export function isSubscriptionFullyExpired(
  b: { trialEndsAt: Date | null; subscriptionEndsAt: Date | null },
  now: Date,
): boolean {
  if (b.trialEndsAt == null && b.subscriptionEndsAt == null) {
    return false;
  }

  const paidOk =
    b.subscriptionEndsAt != null &&
    b.subscriptionEndsAt.getTime() >= now.getTime();
  if (paidOk) return false;

  const trialOk =
    b.trialEndsAt != null && b.trialEndsAt.getTime() >= now.getTime();
  if (trialOk) return false;

  return true;
}

/**
 * Отключить магазин: истёк оплаченный период или нет действующего trial/оплаты.
 * (Подписка по `subscriptionEndsAt` может истечь при ещё действующем trial — всё равно отключаем по ТЗ.)
 */
export function shouldDeactivateStoreForSubscription(
  b: { trialEndsAt: Date | null; subscriptionEndsAt: Date | null },
  now: Date,
): boolean {
  const subscriptionPast =
    b.subscriptionEndsAt != null &&
    b.subscriptionEndsAt.getTime() < now.getTime();
  return subscriptionPast || isSubscriptionFullyExpired(b, now);
}

function daysLeftUntil(end: Date | null, now: Date): number | null {
  if (end == null) return null;
  if (end.getTime() <= now.getTime()) return null;
  return differenceInCalendarDays(end, now);
}

/** Только владелец магазина (без fallback на ADMIN). */
async function findBusinessOwnerTelegramId(
  businessId: number,
): Promise<string | null> {
  const owner = await prisma.membership.findFirst({
    where: { businessId, role: MembershipRole.OWNER },
    include: { user: true },
    orderBy: { id: "asc" },
  });
  const tid = owner?.user?.telegramId;
  return typeof tid === "string" && /^\d+$/.test(tid.trim())
    ? tid.trim()
    : null;
}

async function sendTelegramToUser(
  botToken: string,
  telegramUserId: string,
  text: string,
): Promise<boolean> {
  const chatId = Number(telegramUserId);
  if (!Number.isFinite(chatId) || chatId <= 0) return false;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      },
    );
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
    if (!res.ok || json.ok === false) {
      console.error(
        "subscriptionMaintenance sendMessage failed",
        res.status,
        json,
      );
      return false;
    }
    return true;
  } catch (e) {
    console.error("subscriptionMaintenance sendMessage:", e);
    return false;
  }
}

/**
 * Ежедневный проход: напоминания за 3 и 1 день до `subscriptionEndsAt`, авто-отключение просроченных,
 * уведомление владельцу. `isBlocked` не трогаем; токен бота только для sendMessage.
 */
export async function runSubscriptionMaintenanceOnce(
  now = new Date(),
): Promise<void> {
  const businesses = await prisma.business.findMany({
    select: {
      id: true,
      isActive: true,
      isBlocked: true,
      botToken: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
      lastReminder3DaysAt: true,
      lastReminder1DayAt: true,
    },
  });

  for (const b of businesses) {
    if (b.isBlocked) continue;

    try {
      const subEnd = b.subscriptionEndsAt;

      let subLeft: number | null = null;
      if (b.isActive && subEnd != null && subEnd.getTime() > now.getTime()) {
        subLeft = daysLeftUntil(subEnd, now);
      }

      if (
        subEnd == null &&
        (b.lastReminder3DaysAt != null || b.lastReminder1DayAt != null)
      ) {
        await prisma.business.update({
          where: { id: b.id },
          data: { lastReminder3DaysAt: null, lastReminder1DayAt: null },
        });
        b.lastReminder3DaysAt = null;
        b.lastReminder1DayAt = null;
      }

      const clear3 =
        subLeft != null && subLeft > 3 && b.lastReminder3DaysAt != null;
      const clear1 =
        subLeft != null && subLeft > 1 && b.lastReminder1DayAt != null;
      if (clear3 || clear1) {
        await prisma.business.update({
          where: { id: b.id },
          data: {
            ...(clear3 ? { lastReminder3DaysAt: null } : {}),
            ...(clear1 ? { lastReminder1DayAt: null } : {}),
          },
        });
        if (clear3) b.lastReminder3DaysAt = null;
        if (clear1) b.lastReminder1DayAt = null;
      }

      const ownerTg = await findBusinessOwnerTelegramId(b.id);

      if (
        b.isActive &&
        subLeft === 3 &&
        b.lastReminder3DaysAt == null &&
        ownerTg
      ) {
        const ok = await sendTelegramToUser(
          b.botToken,
          ownerTg,
          "⚠️ Ваша подписка заканчивается через 3 дня",
        );
        if (ok) {
          await prisma.business.update({
            where: { id: b.id },
            data: { lastReminder3DaysAt: now },
          });
          b.lastReminder3DaysAt = now;
        }
      }

      if (
        b.isActive &&
        subLeft === 1 &&
        b.lastReminder1DayAt == null &&
        ownerTg
      ) {
        const ok = await sendTelegramToUser(
          b.botToken,
          ownerTg,
          "⚠️ Подписка закончится завтра",
        );
        if (ok) {
          await prisma.business.update({
            where: { id: b.id },
            data: { lastReminder1DayAt: now },
          });
          b.lastReminder1DayAt = now;
        }
      }

      const shouldDeactivate =
        b.isActive && shouldDeactivateStoreForSubscription(b, now);

      if (shouldDeactivate) {
        await prisma.business.update({
          where: { id: b.id },
          data: {
            isActive: false,
            subscriptionStatus: SubscriptionStatus.EXPIRED,
            lastReminder3DaysAt: null,
            lastReminder1DayAt: null,
          },
        });
        const tgId =
          ownerTg ?? (await findBusinessOwnerTelegramId(b.id));
        if (tgId) {
          await sendTelegramToUser(
            b.botToken,
            tgId,
            "⛔ Подписка истекла. Магазин временно отключён",
          );
        }
        console.log("subscriptionMaintenance: deactivated business", b.id);
      }
    } catch (e) {
      console.error("subscriptionMaintenance: business", b.id, e);
    }
  }
}

/** По умолчанию раз в сутки; переопределение: SUBSCRIPTION_CRON_MS (минимум 60 с). */
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function startSubscriptionMaintenanceScheduler(): void {
  const raw = process.env.SUBSCRIPTION_CRON_MS;
  const ms =
    raw != null && String(raw).trim() !== ""
      ? Number(raw)
      : DEFAULT_INTERVAL_MS;
  const interval = Number.isFinite(ms) && ms >= 60_000 ? ms : DEFAULT_INTERVAL_MS;

  void runSubscriptionMaintenanceOnce().catch((e) =>
    console.error("subscriptionMaintenance initial run:", e),
  );

  setInterval(() => {
    void runSubscriptionMaintenanceOnce().catch((e) =>
      console.error("subscriptionMaintenance tick:", e),
    );
  }, interval);

  const label =
    interval >= 86_400_000
      ? `${Math.round(interval / 86_400_000)}× / day (${interval} ms)`
      : `${Math.round(interval / 60_000)} min`;
  console.log(`subscriptionMaintenance: scheduler ${label}`);
}
