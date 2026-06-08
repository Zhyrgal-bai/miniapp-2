import { SubscriptionStatus } from "@prisma/client";

/** Default free paid orders per store before subscription required. */
export function resolveFreeOrdersLimit(
  businessLimit?: number | null,
): number {
  if (
    businessLimit != null &&
    Number.isInteger(businessLimit) &&
    businessLimit > 0
  ) {
    return businessLimit;
  }
  try {
    const proc = (globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }).process;
    const raw = proc?.env?.ARCHA_FREE_ORDERS_LIMIT;
    if (raw != null && String(raw).trim() !== "") {
      const n = Number(String(raw).trim());
      if (Number.isFinite(n) && n > 0) return Math.round(n);
    }
  } catch {
    /* ignore */
  }
  return 5;
}

export type FreeUsageFields = {
  subscriptionStatus: SubscriptionStatus;
  freeOrdersUsed?: number | null;
  freeOrdersLimit?: number | null;
};

export function isFreeUsageModelEnabled(): boolean {
  try {
    const proc = (globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }).process;
    const raw = proc?.env?.ARCHA_FREE_USAGE_MODEL;
    if (raw == null || String(raw).trim() === "") return true;
    const v = String(raw).trim().toLowerCase();
    return v !== "0" && v !== "false" && v !== "off";
  } catch {
    return true;
  }
}

export function hasFreeOrdersRemaining(b: FreeUsageFields): boolean {
  const used = Math.max(0, b.freeOrdersUsed ?? 0);
  const limit = resolveFreeOrdersLimit(b.freeOrdersLimit);
  return used < limit;
}

export function isFreeTierStatus(status: SubscriptionStatus): boolean {
  return status === SubscriptionStatus.FREE;
}

export function isQuotaExhaustedStatus(status: SubscriptionStatus): boolean {
  return status === SubscriptionStatus.QUOTA_EXHAUSTED;
}

export type MerchantAccessMode =
  | "paid"
  | "grace"
  | "grandfather_trial"
  | "free"
  | "quota_exhausted"
  | "expired";
