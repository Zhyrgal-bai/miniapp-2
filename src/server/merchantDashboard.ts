import { BusinessStaffRole, SubscriptionStatus } from "@prisma/client";
import { prisma } from "./db.js";
import {
  freeOrdersQuotaSummary,
  hasValidPaidOrTrialWindow,
  resolveMerchantAccessMode,
} from "./subscriptionAccess.js";

/** Публичный JSON для Mini App «мои магазины». */
export type MerchantBusinessCard = {
  id: number;
  name: string;
  isActive: boolean;
  isBlocked: boolean;
  role: BusinessStaffRole;
  subscriptionStatus: SubscriptionStatus;
  billingPlan: string | null;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  daysLeft: number | null;
  freeOrdersUsed: number;
  freeOrdersLimit: number;
  freeOrdersRemaining: number;
  accessState: "active" | "blocked" | "pay_required" | "paused" | "quota_exhausted";
};

function calendarWholeDaysAhead(end: Date, now: Date): number | null {
  const utcLater = Date.UTC(
    end.getFullYear(),
    end.getMonth(),
    end.getDate()
  );
  const utcEarlier = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const d = Math.round((utcLater - utcEarlier) / 86400000);
  return d > 0 ? d : null;
}

function summarizeAccess(
  b: {
    isActive: boolean;
    isBlocked: boolean;
    subscriptionStatus: SubscriptionStatus;
    trialEndsAt: Date | null;
    subscriptionEndsAt: Date | null;
    freeOrdersUsed?: number | null;
    freeOrdersLimit?: number | null;
  },
  now: Date
): Pick<
  MerchantBusinessCard,
  "daysLeft" | "accessState" | "freeOrdersUsed" | "freeOrdersLimit" | "freeOrdersRemaining"
> {
  const quota = freeOrdersQuotaSummary(b);
  if (b.isBlocked) {
    return {
      daysLeft: null,
      accessState: "blocked",
      freeOrdersUsed: quota.used,
      freeOrdersLimit: quota.limit,
      freeOrdersRemaining: quota.remaining,
    };
  }

  const mode = resolveMerchantAccessMode(
    { ...b, gracePeriodEndsAt: null },
    now,
  );
  if (mode === "quota_exhausted") {
    return {
      daysLeft: null,
      accessState: "quota_exhausted",
      freeOrdersUsed: quota.used,
      freeOrdersLimit: quota.limit,
      freeOrdersRemaining: 0,
    };
  }

  const entitled = hasValidPaidOrTrialWindow(b, now);
  if (!entitled && mode !== "grace") {
    return {
      daysLeft: null,
      accessState: "pay_required",
      freeOrdersUsed: quota.used,
      freeOrdersLimit: quota.limit,
      freeOrdersRemaining: quota.remaining,
    };
  }

  if (!b.isActive) {
    return {
      daysLeft: null,
      accessState: "paused",
      freeOrdersUsed: quota.used,
      freeOrdersLimit: quota.limit,
      freeOrdersRemaining: quota.remaining,
    };
  }

  const nowTs = now.getTime();
  const paidFuture =
    b.subscriptionEndsAt != null && b.subscriptionEndsAt.getTime() > nowTs;
  const trialFuture =
    b.trialEndsAt != null && b.trialEndsAt.getTime() > nowTs;

  let daysLeft: number | null = null;
  if (paidFuture && b.subscriptionEndsAt) {
    daysLeft = calendarWholeDaysAhead(b.subscriptionEndsAt, now);
  } else if (trialFuture && b.trialEndsAt) {
    daysLeft = calendarWholeDaysAhead(b.trialEndsAt, now);
  }

  return {
    daysLeft,
    accessState: "active",
    freeOrdersUsed: quota.used,
    freeOrdersLimit: quota.limit,
    freeOrdersRemaining: quota.remaining,
  };
}

/** Магазины, где пользователь — staff (не покупатель). */
export async function listMerchantOwnedBusinesses(
  telegramId: string
): Promise<MerchantBusinessCard[]> {
  const identity = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true },
  });
  if (identity == null) {
    return [];
  }

  const staffRows = await prisma.businessStaff.findMany({
    where: { userId: identity.id },
    include: { business: true },
    orderBy: { businessId: "asc" },
  });

  const now = new Date();
  const out: MerchantBusinessCard[] = [];

  for (const m of staffRows) {
    const b = m.business;
    const summary = summarizeAccess(b, now);
    out.push({
      id: b.id,
      name: b.name,
      isActive: b.isActive,
      isBlocked: b.isBlocked,
      role: m.role,
      subscriptionStatus: b.subscriptionStatus,
      billingPlan: b.billingPlan,
      trialEndsAt: b.trialEndsAt?.toISOString() ?? null,
      subscriptionEndsAt: b.subscriptionEndsAt?.toISOString() ?? null,
      ...summary,
    });
  }

  return out;
}
