import { SubscriptionStatus } from "@prisma/client";
import {
  API_ERR_BUSINESS_NOT_FOUND,
  API_ERR_STORE_SUBSCRIPTION_EXPIRED,
  API_ERR_STORE_UNAVAILABLE,
} from "../shared/apiClientMessages.js";

/** Поля подписки для проверки доступа (без финансовых атрибутов витрины). */
export type SubscriptionGateFields = {
  isBlocked: boolean;
  isActive: boolean;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
};

/** Prisma select для проверок витрины / каталога / checkout. */
export const businessSubscriptionGateSelect = {
  id: true,
  isActive: true,
  isBlocked: true,
  subscriptionStatus: true,
  trialEndsAt: true,
  subscriptionEndsAt: true,
} as const;

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

/**
 * Магазин принимает заказы и открыт для покупателей (витрина, каталог, checkout).
 */
export function canAcceptCustomerOrders(
  b: SubscriptionGateFields,
  now = new Date(),
): boolean {
  return customerOrdersRejectionReason(b, now) === null;
}

/** Сообщение для 403/404 или null, если покупательские операции разрешены. */
export function customerOrdersRejectionReason(
  b: SubscriptionGateFields | null | undefined,
  now = new Date(),
): string | null {
  if (b == null) return API_ERR_BUSINESS_NOT_FOUND;
  if (b.isBlocked || !b.isActive) return API_ERR_STORE_UNAVAILABLE;
  if (!hasValidPaidOrTrialWindow(b, now)) {
    return API_ERR_STORE_SUBSCRIPTION_EXPIRED;
  }
  return null;
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
 * @deprecated Используйте !canAcceptCustomerOrders(b) с полями подписки.
 */
export function isStorefrontClosedForCustomers(
  b: SubscriptionGateFields,
  now = new Date(),
): boolean {
  return !canAcceptCustomerOrders(b, now);
}
