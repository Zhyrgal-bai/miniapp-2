import {
  API_ERR_BUSINESS_NOT_FOUND,
  API_ERR_STORE_QUOTA_EXHAUSTED,
  API_ERR_STORE_SUBSCRIPTION_EXPIRED,
  API_ERR_STORE_UNAVAILABLE,
} from "../shared/apiClientMessages.js";
import {
  hasFreeOrdersRemaining,
  isFreeTierStatus,
  isFreeUsageModelEnabled,
  isQuotaExhaustedStatus,
  type MerchantAccessMode,
  resolveFreeOrdersLimit,
} from "../shared/freeUsageModel.js";
import { SubscriptionStatus } from "@prisma/client";

/** Поля подписки для проверки доступа (без финансовых атрибутов витрины). */
export type SubscriptionGateFields = {
  isBlocked: boolean;
  isActive: boolean;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
  gracePeriodEndsAt?: Date | null;
  freeOrdersUsed?: number | null;
  freeOrdersLimit?: number | null;
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
  freeOrdersUsed: true,
  freeOrdersLimit: true,
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

function hasValidPaidWindow(
  b: Pick<
    SubscriptionGateFields,
    "subscriptionStatus" | "subscriptionEndsAt"
  >,
  now = new Date(),
): boolean {
  const t = now.getTime();
  switch (b.subscriptionStatus) {
    case SubscriptionStatus.ACTIVE:
    case SubscriptionStatus.PAST_DUE:
      return (
        b.subscriptionEndsAt != null && b.subscriptionEndsAt.getTime() >= t
      );
    default:
      return false;
  }
}

/** Grandfather: active 10-day trial until trialEndsAt. */
export function hasGrandfatherTrialWindow(
  b: Pick<
    SubscriptionGateFields,
    "subscriptionStatus" | "trialEndsAt" | "subscriptionEndsAt"
  >,
  now = new Date(),
): boolean {
  if (!isFreeUsageModelEnabled()) {
    return hasLegacyTrialWindow(b, now);
  }
  if (b.subscriptionStatus !== SubscriptionStatus.TRIALING) return false;
  const t = now.getTime();
  if (
    b.subscriptionEndsAt != null &&
    b.subscriptionEndsAt.getTime() < t
  ) {
    return false;
  }
  return b.trialEndsAt != null && b.trialEndsAt.getTime() >= t;
}

function hasLegacyTrialWindow(
  b: Pick<
    SubscriptionGateFields,
    "subscriptionStatus" | "trialEndsAt" | "subscriptionEndsAt"
  >,
  now = new Date(),
): boolean {
  const t = now.getTime();
  if (b.subscriptionStatus !== SubscriptionStatus.TRIALING) return false;
  if (
    b.subscriptionEndsAt != null &&
    b.subscriptionEndsAt.getTime() < t
  ) {
    return false;
  }
  return b.trialEndsAt != null && b.trialEndsAt.getTime() >= t;
}

export function hasValidFreeQuotaWindow(
  b: SubscriptionGateFields,
): boolean {
  if (!isFreeUsageModelEnabled()) return false;
  if (isQuotaExhaustedStatus(b.subscriptionStatus)) return false;
  if (isFreeTierStatus(b.subscriptionStatus)) {
    return hasFreeOrdersRemaining(b);
  }
  return false;
}

/**
 * Есть действующее оплатное окно, free quota или grandfather trial (без grace).
 */
export function hasValidPaidOrTrialWindow(
  b: SubscriptionGateFields,
  now = new Date(),
): boolean {
  if (hasValidPaidWindow(b, now)) return true;
  if (hasGrandfatherTrialWindow(b, now)) return true;
  return hasValidFreeQuotaWindow(b);
}

/** @deprecated Alias — prefer hasValidPaidOrTrialWindow (includes free quota). */
export const hasValidPaidOrFreeWindow = hasValidPaidOrTrialWindow;

export function resolveMerchantAccessMode(
  b: SubscriptionGateFields,
  now = new Date(),
): MerchantAccessMode {
  if (hasValidPaidWindow(b, now)) return "paid";
  if (isInSubscriptionGracePeriod(b, now)) return "grace";
  if (hasGrandfatherTrialWindow(b, now)) return "grandfather_trial";
  if (isFreeUsageModelEnabled()) {
    if (isQuotaExhaustedStatus(b.subscriptionStatus)) return "quota_exhausted";
    if (isFreeTierStatus(b.subscriptionStatus) && hasFreeOrdersRemaining(b)) {
      return "free";
    }
    if (
      isFreeTierStatus(b.subscriptionStatus) &&
      !hasFreeOrdersRemaining(b)
    ) {
      return "quota_exhausted";
    }
  }
  return "expired";
}

/** Магазин в оплаченном окне, free quota, grandfather trial или grace. */
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

  const mode = resolveMerchantAccessMode(b, now);
  if (mode === "quota_exhausted") {
    return API_ERR_STORE_QUOTA_EXHAUSTED;
  }
  if (!hasCustomerAccessWindow(b, now)) {
    return API_ERR_STORE_SUBSCRIPTION_EXPIRED;
  }
  return null;
}

/** Магазин может работать для клиентов: не заблокирован, витрина включена, есть доступ. */
export function isSubscriptionActive(
  b: SubscriptionGateFields,
  now = new Date(),
): boolean {
  if (b.isBlocked) return false;
  if (!b.isActive) return false;
  return hasCustomerAccessWindow(b, now);
}

/**
 * Premium-функции платформы (настройки, Finik, bot token) — paid/trial/free, не grace.
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

export function freeOrdersQuotaSummary(b: SubscriptionGateFields): {
  used: number;
  limit: number;
  remaining: number;
} {
  const limit = resolveFreeOrdersLimit(b.freeOrdersLimit);
  const used = Math.min(Math.max(0, b.freeOrdersUsed ?? 0), limit);
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
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
