import { SubscriptionStatus } from "@prisma/client";

/** Поля подписки для проверки доступа (без финансовых атрибутов витрины). */
export type SubscriptionGateFields = {
  isBlocked: boolean;
  isActive: boolean;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
};

/**
 * Есть действующее оплатное окно или действующий trial (без учёта флагов isActive / isBlocked).
 * TRIALING: если задан истёкший subscriptionEndsAt — доступа нет (согласовано с автодеактивацией cron).
 */
export function hasValidPaidOrTrialWindow(
  b: Pick<
    SubscriptionGateFields,
    "subscriptionStatus" | "trialEndsAt" | "subscriptionEndsAt"
  >,
  now = new Date(),
): boolean {
  const t = now.getTime();

  switch (b.subscriptionStatus) {
    case SubscriptionStatus.ACTIVE:
      return (
        b.subscriptionEndsAt != null && b.subscriptionEndsAt.getTime() >= t
      );
    case SubscriptionStatus.TRIALING: {
      if (
        b.subscriptionEndsAt != null &&
        b.subscriptionEndsAt.getTime() < t
      ) {
        return false;
      }
      return b.trialEndsAt != null && b.trialEndsAt.getTime() >= t;
    }
    default:
      return false;
  }
}

/** Магазин может работать для клиентов: не заблокирован, витрина включена, есть оплата/trial по срокам. */
export function isSubscriptionActive(
  b: SubscriptionGateFields,
  now = new Date(),
): boolean {
  if (b.isBlocked) return false;
  if (!b.isActive) return false;
  return hasValidPaidOrTrialWindow(b, now);
}

/** Право менять настройки платформы / включать бота после оплаты: не блок + есть окно подписки/trial. */
export function merchantStoreEntitled(
  b: SubscriptionGateFields,
  now = new Date(),
): boolean {
  if (b.isBlocked) return false;
  return hasValidPaidOrTrialWindow(b, now);
}

/**
 * Для клиента Mini App (?shop=/каталог): витрина «закрыта» только по флагам.
 * Истечение подписки не отключает публичный каталог/`/api/me` — это слой платформы/мерчанта отдельно.
 */
export function isStorefrontClosedForCustomers(b: {
  isActive: boolean;
  isBlocked: boolean;
}): boolean {
  return b.isBlocked || !b.isActive;
}
