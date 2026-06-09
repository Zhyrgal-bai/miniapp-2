import { BusinessStaffRole, SubscriptionStatus } from "@prisma/client";
import { prisma } from "./db.js";
import {
  hasFreeOrdersRemaining,
  resolveFreeOrdersLimit,
} from "../shared/freeUsageModel.js";
import { plainBotTokenFromStored } from "./businessBotToken.js";
import { ORDER_ANALYTICS_SUCCESS_STATUSES_DB } from "../shared/orderAnalytics.js";

const PAID_ORDER_STATUSES = [...ORDER_ANALYTICS_SUCCESS_STATUSES_DB] as const;

function freeQuotaMilestoneMessage(used: number, limit: number): string {
  const safeLimit = Math.max(1, limit);
  const safeUsed = Math.max(0, Math.min(safeLimit, used));
  if (safeUsed >= safeLimit) {
    return `Лимит бесплатных заказов исчерпан (${safeLimit}/${safeLimit}). Оплатите подписку в Mini App, чтобы снова принимать заказы.`;
  }
  const remaining = Math.max(0, safeLimit - safeUsed);
  return `Прогресс бесплатных заказов: ${safeUsed}/${safeLimit}. Осталось ${remaining}. Подключите подписку заранее, чтобы не останавливать продажи.`;
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

async function sendOwnerTelegram(
  businessId: number,
  text: string,
): Promise<void> {
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { botToken: true },
  });
  if (!biz?.botToken) return;
  const ownerTid = await findBusinessOwnerTelegramId(businessId);
  if (!ownerTid) return;
  const token = plainBotTokenFromStored(biz.botToken);
  const chatId = Number(ownerTid);
  if (!Number.isFinite(chatId) || chatId <= 0) return;
  try {
    await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      },
    );
  } catch (e) {
    console.error("[freeOrderQuota] owner notify failed:", e);
  }
}

export async function applyQuotaExhausted(
  businessId: number,
  now = new Date(),
): Promise<void> {
  const updated = await prisma.business.update({
    where: { id: businessId },
    data: {
      subscriptionStatus: SubscriptionStatus.QUOTA_EXHAUSTED,
      quotaExhaustedAt: now,
    },
    select: { freeOrdersLimit: true },
  });
  const limit = resolveFreeOrdersLimit(updated.freeOrdersLimit);
  void sendOwnerTelegram(
    businessId,
    freeQuotaMilestoneMessage(limit, limit),
  );
}

/** Grandfather trial ended → FREE or QUOTA_EXHAUSTED based on usage. */
export async function transitionTrialToFreeTier(
  businessId: number,
): Promise<void> {
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
      freeOrdersUsed: true,
      freeOrdersLimit: true,
    },
  });
  if (b == null) return;
  if (b.subscriptionStatus !== SubscriptionStatus.TRIALING) return;
  const now = new Date();
  if (b.trialEndsAt != null && b.trialEndsAt.getTime() > now.getTime()) return;
  if (
    b.subscriptionEndsAt != null &&
    b.subscriptionEndsAt.getTime() > now.getTime()
  ) {
    return;
  }

  const limit = resolveFreeOrdersLimit(b.freeOrdersLimit);
  const used = Math.max(0, b.freeOrdersUsed ?? 0);
  if (used >= limit || !hasFreeOrdersRemaining({ ...b, subscriptionStatus: SubscriptionStatus.FREE })) {
    await applyQuotaExhausted(businessId, now);
    return;
  }

  await prisma.business.update({
    where: { id: businessId },
    data: {
      subscriptionStatus: SubscriptionStatus.FREE,
      isActive: true,
    },
  });
}

/**
 * Increment free-order quota after paid order (idempotent via FreeOrderQuotaEvent).
 * Only counts when store has no active paid subscription window.
 */
export async function incrementFreeOrderQuotaOnPaid(
  orderId: number,
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, businessId: true, status: true },
  });
  if (order == null) return;
  if (!PAID_ORDER_STATUSES.includes(order.status as (typeof PAID_ORDER_STATUSES)[number])) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.freeOrderQuotaEvent.findUnique({
      where: { orderId },
    });
    if (existing != null) return;

    const biz = await tx.business.findUnique({
      where: { id: order.businessId },
      select: {
        id: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
        freeOrdersUsed: true,
        freeOrdersLimit: true,
      },
    });
    if (biz == null) return;

    const now = new Date();
    const paidActive =
      biz.subscriptionStatus === SubscriptionStatus.ACTIVE &&
      biz.subscriptionEndsAt != null &&
      biz.subscriptionEndsAt.getTime() >= now.getTime();
    if (paidActive) return;

    await tx.freeOrderQuotaEvent.create({
      data: { orderId: order.id, businessId: order.businessId },
    });

    const limit = resolveFreeOrdersLimit(biz.freeOrdersLimit);
    const nextUsed = Math.min(limit, Math.max(0, (biz.freeOrdersUsed ?? 0) + 1));

    const updateData: {
      freeOrdersUsed: number;
      subscriptionStatus?: SubscriptionStatus;
      quotaExhaustedAt?: Date;
    } = { freeOrdersUsed: nextUsed };

    if (nextUsed >= limit) {
      updateData.subscriptionStatus = SubscriptionStatus.QUOTA_EXHAUSTED;
      updateData.quotaExhaustedAt = now;
    } else if (
      biz.subscriptionStatus === SubscriptionStatus.TRIALING ||
      biz.subscriptionStatus === SubscriptionStatus.EXPIRED
    ) {
      updateData.subscriptionStatus = SubscriptionStatus.FREE;
    }

    await tx.business.update({
      where: { id: biz.id },
      data: updateData,
    });

    const milestoneUsed = new Set<number>([
      Math.max(1, limit - 2),
      Math.max(1, limit - 1),
      limit,
    ]);
    if (milestoneUsed.has(nextUsed)) {
      void sendOwnerTelegram(
        biz.id,
        freeQuotaMilestoneMessage(nextUsed, limit),
      );
    }
  });
}
