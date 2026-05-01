import { MembershipRole, SubscriptionStatus } from "@prisma/client";
import { prisma } from "./db.js";
import { isSubscriptionFullyExpired } from "./subscriptionMaintenance.js";

/** Публичный JSON для Mini App «мои магазины». */
export type MerchantBusinessCard = {
  id: number;
  name: string;
  isActive: boolean;
  isBlocked: boolean;
  role: MembershipRole;
  subscriptionStatus: SubscriptionStatus;
  billingPlan: string | null;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  /** Календарных дней до окончания текущего окна (подписка или триал); null если без срока / истёк. */
  daysLeft: number | null;
  /** active | blocked | pay_required | paused — для текстовых бэйджей. */
  accessState: "active" | "blocked" | "pay_required" | "paused";
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
  },
  now: Date
): Pick<MerchantBusinessCard, "daysLeft" | "accessState"> {
  if (b.isBlocked) {
    return { daysLeft: null, accessState: "blocked" };
  }
  if (!b.isActive) {
    return { daysLeft: null, accessState: "paused" };
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

  const noAnchors =
    b.trialEndsAt == null && b.subscriptionEndsAt == null;

  /** Окно триала/оплаты ещё жива или срок не задан (= безлимит). */
  if (paidFuture || trialFuture || noAnchors) {
    return {
      daysLeft: noAnchors ? null : daysLeft,
      accessState: "active",
    };
  }

  const statusBlocked =
    b.subscriptionStatus === SubscriptionStatus.EXPIRED ||
    b.subscriptionStatus === SubscriptionStatus.CANCELED ||
    b.subscriptionStatus === SubscriptionStatus.PAST_DUE;

  const windowDead = isSubscriptionFullyExpired(
    {
      trialEndsAt: b.trialEndsAt,
      subscriptionEndsAt: b.subscriptionEndsAt,
    },
    now
  );

  if (!statusBlocked && !windowDead) {
    return { daysLeft: null, accessState: "active" };
  }

  return { daysLeft: null, accessState: "pay_required" };
}

/** Магазины, которыми владеет пользователь Telegram (OWNER/ADMIN после SaaS). */
export async function listMerchantOwnedBusinesses(
  telegramId: string
): Promise<MerchantBusinessCard[]> {
  const identity = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true },
  });
  if (!identity) {
    return [];
  }

  const memberships = await prisma.membership.findMany({
    where: {
      userId: identity.id,
      role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN] },
    },
    include: { business: true },
    orderBy: { businessId: "asc" },
  });

  const now = new Date();
  const out: MerchantBusinessCard[] = [];

  for (const m of memberships) {
    const b = m.business;
    const summary = summarizeAccess(b, now);
    out.push({
      id: b.id,
      name: b.name,
      isActive: b.isActive,
      isBlocked: b.isBlocked,
      role: m.role,
      subscriptionStatus: b.subscriptionStatus,
      billingPlan: b.billingPlan != null ? String(b.billingPlan) : null,
      trialEndsAt: b.trialEndsAt?.toISOString() ?? null,
      subscriptionEndsAt: b.subscriptionEndsAt?.toISOString() ?? null,
      daysLeft: summary.daysLeft,
      accessState: summary.accessState,
    });
  }

  return out;
}
