import { SubscriptionStatus, UserRole } from "@prisma/client";
import { prisma } from "./db.js";

function pluralDaysRu(n: number): string {
  const m = n % 10;
  const m100 = n % 100;
  if (m100 >= 11 && m100 <= 14) return "дней";
  if (m === 1) return "день";
  if (m >= 2 && m <= 4) return "дня";
  return "дней";
}

/** Calendar-day difference: `later` vs `earlier` (same semantics as date-fns `differenceInDays`). */
function differenceInCalendarDays(later: Date, earlier: Date): number {
  const utcLater = Date.UTC(
    later.getFullYear(),
    later.getMonth(),
    later.getDate()
  );
  const utcEarlier = Date.UTC(
    earlier.getFullYear(),
    earlier.getMonth(),
    earlier.getDate()
  );
  return Math.round((utcLater - utcEarlier) / 86400000);
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

function alreadyNotifiedToday(
  lastNotifiedAt: Date | null,
  now: Date
): boolean {
  if (lastNotifiedAt == null) return false;
  return startOfUtcDay(lastNotifiedAt).getTime() === startOfUtcDay(now).getTime();
}

/**
 * No valid paid window and no valid trial window → fully expired (auto-deactivate).
 */
export function isSubscriptionFullyExpired(
  b: { trialEndsAt: Date | null; subscriptionEndsAt: Date | null },
  now: Date
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

function daysLeftUntil(end: Date | null, now: Date): number | null {
  if (end == null) return null;
  if (end.getTime() <= now.getTime()) return null;
  return differenceInCalendarDays(end, now);
}

async function findPrimaryOwnerTelegramId(
  businessId: number
): Promise<string | null> {
  const owner = await prisma.user.findFirst({
    where: { businessId, role: UserRole.OWNER },
    select: { telegramId: true },
    orderBy: { id: "asc" },
  });
  if (owner) return owner.telegramId;
  const anyUser = await prisma.user.findFirst({
    where: { businessId },
    select: { telegramId: true },
    orderBy: { id: "asc" },
  });
  return anyUser?.telegramId ?? null;
}

async function sendTelegramToUser(
  botToken: string,
  telegramUserId: string,
  text: string
): Promise<void> {
  const chatId = Number(telegramUserId);
  if (!Number.isFinite(chatId) || chatId <= 0) return;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      }
    );
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
    if (!res.ok || json.ok === false) {
      console.error("subscriptionMaintenance sendMessage failed", res.status, json);
    }
  } catch (e) {
    console.error("subscriptionMaintenance sendMessage:", e);
  }
}

const REMINDER_DAYS = new Set([3, 1]);

/**
 * Hourly (or configured) pass: reminders at 3 and 1 days before trial/sub end,
 * deactivate expired stores, optional Telegram to owner.
 */
export async function runSubscriptionMaintenanceOnce(now = new Date()): Promise<void> {
  const businesses = await prisma.business.findMany();

  for (const b of businesses) {
    try {
      const trialLeft = b.isActive ? daysLeftUntil(b.trialEndsAt, now) : null;
      const subLeft = b.isActive
        ? daysLeftUntil(b.subscriptionEndsAt, now)
        : null;

      const wantTrialReminder =
        trialLeft != null && REMINDER_DAYS.has(trialLeft);
      const wantSubReminder =
        subLeft != null && REMINDER_DAYS.has(subLeft);

      if (b.isActive && (wantTrialReminder || wantSubReminder)) {
        if (!alreadyNotifiedToday(b.lastNotifiedAt, now)) {
          const parts: string[] = [];
          const ruDays = (n: number) =>
            `${n} ${pluralDaysRu(n)}`;
          if (wantTrialReminder && trialLeft != null) {
            parts.push(
              `Ваша подписка истекает через ${ruDays(trialLeft)} (триал).`
            );
          }
          if (wantSubReminder && subLeft != null) {
            parts.push(
              `Ваша подписка истекает через ${ruDays(subLeft)} (оплаченный период).`
            );
          }
          const text = parts.join("\n");
          const tgId = await findPrimaryOwnerTelegramId(b.id);
          if (tgId) {
            await sendTelegramToUser(b.botToken, tgId, text);
          }
          await prisma.business.update({
            where: { id: b.id },
            data: { lastNotifiedAt: now },
          });
        }
      }

      if (b.isActive && isSubscriptionFullyExpired(b, now)) {
        await prisma.business.update({
          where: { id: b.id },
          data: {
            isActive: false,
            subscriptionStatus: SubscriptionStatus.EXPIRED,
          },
        });
        const tgId = await findPrimaryOwnerTelegramId(b.id);
        if (tgId) {
          await sendTelegramToUser(
            b.botToken,
            tgId,
            "Ваша подписка истекла. Оплатите для продолжения."
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
  const ms = raw != null && String(raw).trim() !== "" ? Number(raw) : DEFAULT_INTERVAL_MS;
  const interval = Number.isFinite(ms) && ms >= 60_000 ? ms : DEFAULT_INTERVAL_MS;

  void runSubscriptionMaintenanceOnce().catch((e) =>
    console.error("subscriptionMaintenance initial run:", e)
  );

  setInterval(() => {
    void runSubscriptionMaintenanceOnce().catch((e) =>
      console.error("subscriptionMaintenance tick:", e)
    );
  }, interval);

  console.log(
    `subscriptionMaintenance: scheduler every ${Math.round(interval / 60000)} min`
  );
}
