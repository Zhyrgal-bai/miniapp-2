import { BusinessStaffRole, SubscriptionStatus } from "@prisma/client";
import { plainBotTokenFromStored } from "./businessBotToken.js";
import { prisma } from "./db.js";
import {
  hasValidPaidOrTrialWindow,
  isInSubscriptionGracePeriod,
} from "./subscriptionAccess.js";
import {
  ARCHA_AUTO_RENEW_INVOICE_DAYS_BEFORE,
  ARCHA_SUBSCRIPTION_GRACE_DAYS,
} from "../shared/archaSubscriptionPlans.js";
import {
  createPlatformSubscriptionPaymentSession,
  findPendingSubscriptionFinikPayment,
} from "./platformSubscriptionBilling.js";

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

export function shouldDeactivateStoreForSubscription(
  b: {
    trialEndsAt: Date | null;
    subscriptionEndsAt: Date | null;
    gracePeriodEndsAt?: Date | null;
  },
  now: Date,
): boolean {
  if (isInSubscriptionGracePeriod(b, now)) return false;
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

async function findBusinessOwnerTelegramId(
  businessId: number,
): Promise<string | null> {
  const owner = await prisma.businessStaff.findFirst({
    where: { businessId, role: BusinessStaffRole.OWNER },
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
  extra?: { reply_markup?: unknown },
): Promise<boolean> {
  const chatId = Number(telegramUserId);
  if (!Number.isFinite(chatId) || chatId <= 0) return false;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          ...(extra ?? {}),
        }),
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

function renewInlineKeyboard(paymentUrl: string) {
  return {
    inline_keyboard: [[{ text: "Продлить", url: paymentUrl }]],
  };
}

async function tryAutoRenewInvoice(
  b: {
    id: number;
    subscriptionEndsAt: Date | null;
    subscriptionPlanCode: string | null;
    autoRenewEnabled: boolean;
    lastAutoRenewAttemptAt: Date | null;
  },
  subLeft: number | null,
  ownerTg: string | null,
  plainTok: string,
  now: Date,
): Promise<void> {
  if (!b.autoRenewEnabled || ownerTg == null || subLeft == null) return;
  if (subLeft !== ARCHA_AUTO_RENEW_INVOICE_DAYS_BEFORE) return;
  if (b.subscriptionEndsAt == null) return;

  const pending = await findPendingSubscriptionFinikPayment(b.id);
  if (pending != null) {
    return;
  }

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  if (
    b.lastAutoRenewAttemptAt != null &&
    b.lastAutoRenewAttemptAt.getTime() >= dayStart.getTime()
  ) {
    return;
  }

  const planCode =
    (b.subscriptionPlanCode?.trim().toUpperCase() as
      | "MONTHLY"
      | "HALF_YEAR"
      | "YEARLY"
      | undefined) ?? "MONTHLY";

  const out = await createPlatformSubscriptionPaymentSession({
    telegramId: ownerTg,
    businessId: b.id,
    planCode,
    source: "auto_renew",
  });

  if (!out.ok) {
    await sendTelegramToUser(
      plainTok,
      ownerTg,
      "⚠️ Не удалось создать счёт автопродления ARCHA. Продлите подписку вручную в панели магазина.",
    );
    return;
  }

  await prisma.business.update({
    where: { id: b.id },
    data: { lastAutoRenewAttemptAt: now },
  });

  await sendTelegramToUser(
    plainTok,
    ownerTg,
    `🔄 Автопродление ARCHA: счёт на оплату подписки.\n\nОплатите до окончания текущего периода, чтобы магазин работал без перерыва.`,
    { reply_markup: renewInlineKeyboard(out.paymentUrl) },
  );
}

/**
 * Ежедневный проход: напоминания, grace, auto-renew invoice, авто-отключение.
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
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
      gracePeriodEndsAt: true,
      subscriptionPlanCode: true,
      autoRenewEnabled: true,
      lastReminder7DaysAt: true,
      lastReminder3DaysAt: true,
      lastReminder1DayAt: true,
      lastReminderAfterExpiryAt: true,
      lastAutoRenewAttemptAt: true,
    },
  });

  for (const b of businesses) {
    if (b.isBlocked) continue;

    try {
      const plainTok = plainBotTokenFromStored(b.botToken);
      const subEnd = b.subscriptionEndsAt;
      const ownerTg = await findBusinessOwnerTelegramId(b.id);

      let subLeft: number | null = null;
      if (subEnd != null && subEnd.getTime() > now.getTime()) {
        subLeft = daysLeftUntil(subEnd, now);
      }

      if (
        subEnd == null &&
        (b.lastReminder7DaysAt != null ||
          b.lastReminder3DaysAt != null ||
          b.lastReminder1DayAt != null)
      ) {
        await prisma.business.update({
          where: { id: b.id },
          data: {
            lastReminder7DaysAt: null,
            lastReminder3DaysAt: null,
            lastReminder1DayAt: null,
          },
        });
      }

      const clearReminders: Record<string, null> = {};
      if (subLeft != null && subLeft > 7 && b.lastReminder7DaysAt != null) {
        clearReminders.lastReminder7DaysAt = null;
      }
      if (subLeft != null && subLeft > 3 && b.lastReminder3DaysAt != null) {
        clearReminders.lastReminder3DaysAt = null;
      }
      if (subLeft != null && subLeft > 1 && b.lastReminder1DayAt != null) {
        clearReminders.lastReminder1DayAt = null;
      }
      if (Object.keys(clearReminders).length > 0) {
        await prisma.business.update({
          where: { id: b.id },
          data: clearReminders,
        });
      }

      if (b.isActive && subLeft != null && ownerTg) {
        if (subLeft === 7 && b.lastReminder7DaysAt == null) {
          const ok = await sendTelegramToUser(
            plainTok,
            ownerTg,
            "⚠️ Подписка ARCHA заканчивается через 7 дней.\n\nПродлите магазин, чтобы избежать ограничений.",
          );
          if (ok) {
            await prisma.business.update({
              where: { id: b.id },
              data: { lastReminder7DaysAt: now },
            });
          }
        }
        if (subLeft === 3 && b.lastReminder3DaysAt == null) {
          const ok = await sendTelegramToUser(
            plainTok,
            ownerTg,
            "⚠️ Подписка ARCHA заканчивается через 3 дня.\n\nПродлите магазин, чтобы избежать ограничений.",
          );
          if (ok) {
            await prisma.business.update({
              where: { id: b.id },
              data: { lastReminder3DaysAt: now },
            });
          }
        }
        if (subLeft === 1 && b.lastReminder1DayAt == null) {
          const ok = await sendTelegramToUser(
            plainTok,
            ownerTg,
            "⚠️ Подписка ARCHA заканчивается завтра.\n\nПродлите магазин, чтобы избежать ограничений.",
          );
          if (ok) {
            await prisma.business.update({
              where: { id: b.id },
              data: { lastReminder1DayAt: now },
            });
          }
        }

        await tryAutoRenewInvoice(
          b,
          subLeft,
          ownerTg,
          plainTok,
          now,
        );
      }

      const paidWindow =
        subEnd != null && subEnd.getTime() > now.getTime();
      const inGrace = isInSubscriptionGracePeriod(b, now);

      if (
        b.isActive &&
        !paidWindow &&
        subEnd != null &&
        subEnd.getTime() <= now.getTime() &&
        !inGrace &&
        b.gracePeriodEndsAt == null
      ) {
        const graceEnd = new Date(
          subEnd.getTime() + ARCHA_SUBSCRIPTION_GRACE_DAYS * 86400000,
        );
        await prisma.business.update({
          where: { id: b.id },
          data: {
            subscriptionStatus: SubscriptionStatus.PAST_DUE,
            gracePeriodEndsAt: graceEnd,
            isActive: true,
          },
        });
        if (ownerTg && b.lastReminderAfterExpiryAt == null) {
          const ok = await sendTelegramToUser(
            plainTok,
            ownerTg,
            `⛔ Подписка ARCHA закончилась.\n\nУ вас ${ARCHA_SUBSCRIPTION_GRACE_DAYS} дней grace period — заказы пока работают. Продлите подписку, чтобы не потерять доступ.`,
          );
          if (ok) {
            await prisma.business.update({
              where: { id: b.id },
              data: { lastReminderAfterExpiryAt: now },
            });
          }
        }
        continue;
      }

      const shouldDeactivate =
        b.isActive &&
        !hasValidPaidOrTrialWindow(
          {
            subscriptionStatus: b.subscriptionStatus,
            trialEndsAt: b.trialEndsAt,
            subscriptionEndsAt: b.subscriptionEndsAt,
          },
          now,
        ) &&
        !isInSubscriptionGracePeriod(b, now);

      if (shouldDeactivate) {
        await prisma.business.update({
          where: { id: b.id },
          data: {
            isActive: false,
            subscriptionStatus: SubscriptionStatus.EXPIRED,
            gracePeriodEndsAt: null,
            lastReminder3DaysAt: null,
            lastReminder1DayAt: null,
            lastReminder7DaysAt: null,
            lastReminderAfterExpiryAt: null,
          },
        });
        const tgId = ownerTg ?? (await findBusinessOwnerTelegramId(b.id));
        if (tgId) {
          await sendTelegramToUser(
            plainTok,
            tgId,
            "⛔ Grace period закончился. Магазин временно отключён. Продлите подписку ARCHA в панели.",
          );
        }
        console.log("subscriptionMaintenance: deactivated business", b.id);
      }
    } catch (e) {
      console.error("subscriptionMaintenance: business", b.id, e);
    }
  }
}

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

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
