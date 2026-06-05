import {
  API_ERR_BUSINESS_NOT_FOUND,
  API_ERR_STORE_SUBSCRIPTION_EXPIRED,
  API_ERR_STORE_UNAVAILABLE,
} from "../shared/apiClientMessages.js";
import { SubscriptionStatus } from "@prisma/client";

/** Поля подписки для проверки доступа (без финансовых атрибутов витрины). */
export type SubscriptionGateFields = {
  isBlocked: boolean;
  isActive: boolean;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
  gracePeriodEndsAt?: Date | null;
};

/** Prisma select для проверок витрины / каталога / checkout. */
export const businessSubscriptionGateSelect = {
  id: true,
  isActive: true,
  isBlocked: true,
  subscriptionStatus: true,
  trialEndsAt: true,
  subscriptionEndsAt: true,
  gracePeriodEndsAt: true,
} as const;

export function isInSubscriptionGracePeriod(
  b: Pick<
    SubscriptionGateFields,
    "subscriptionEndsAt" | "gracePeriodEndsAt"
  >,
  now = new Date(),
): boolean {
  if (b.gracePeriodEndsAt == null) return false;
  const t = now.getTime();
  if (b.gracePeriodEndsAt.getTime() < t) return false;
  if (b.subscriptionEndsAt == null) return false;
  return b.subscriptionEndsAt.getTime() <= t;
}

/**
 * Есть действующее оплатное окно или действующий trial (без grace).
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
    case SubscriptionStatus.PAST_DUE:
      return (
        b.subscriptionEndsAt != null && b.subscriptionEndsAt.getTime() >= t
      );
    default:
      return false;
  }
}

/** Магазин в оплаченном окне или grace period (витрина, заказы, история). */
export function hasCustomerAccessWindow(
  b: SubscriptionGateFields,
  now = new Date(),
): boolean {
  if (hasValidPaidOrTrialWindow(b, now)) return true;
  return isInSubscriptionGracePeriod(b, now);
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
  if (!hasCustomerAccessWindow(b, now)) {
    return API_ERR_STORE_SUBSCRIPTION_EXPIRED;
  }
  return null;
}

/** Магазин может работать для клиентов: не заблокирован, витрина включена, есть оплата/trial/grace. */
export function isSubscriptionActive(
  b: SubscriptionGateFields,
  now = new Date(),
): boolean {
  if (b.isBlocked) return false;
  if (!b.isActive) return false;
  return hasCustomerAccessWindow(b, now);
}

/**
 * Premium-функции платформы (настройки, Finik, bot token) — только paid/trial, не grace.
 */
export function merchantStoreEntitled(
  b: SubscriptionGateFields,
  now = new Date(),
): boolean {
  if (b.isBlocked) return false;
  return hasValidPaidOrTrialWindow(b, now);
}

/** Витрина открыта для покупателей (включая grace). */
export function merchantStorefrontEntitled(
  b: SubscriptionGateFields,
  now = new Date(),
): boolean {
  if (b.isBlocked) return false;
  return hasCustomerAccessWindow(b, now);
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
