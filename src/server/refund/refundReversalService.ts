import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "../db.js";
import {
  computeLoyaltyAccrual,
  normalizeLoyaltyRules,
} from "../../shared/loyaltyModel.js";
import { resolveCustomerKey } from "../../shared/customerProfile.js";
import { resolveFreeOrdersLimit } from "../../shared/freeUsageModel.js";

/**
 * Reverse free-order quota increment when a paid order is refunded.
 * Idempotent: no-op if no FreeOrderQuotaEvent exists for the order.
 */
export async function reverseFreeOrderQuotaOnRefund(orderId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const event = await tx.freeOrderQuotaEvent.findUnique({
      where: { orderId },
    });
    if (event == null) return;

    await tx.freeOrderQuotaEvent.delete({ where: { orderId } });

    const biz = await tx.business.findUnique({
      where: { id: event.businessId },
      select: {
        id: true,
        freeOrdersUsed: true,
        freeOrdersLimit: true,
        subscriptionStatus: true,
      },
    });
    if (biz == null) return;

    const limit = resolveFreeOrdersLimit(biz.freeOrdersLimit);
    const prevUsed = Math.max(0, biz.freeOrdersUsed ?? 0);
    const nextUsed = Math.max(0, prevUsed - 1);

    const updateData: {
      freeOrdersUsed: number;
      subscriptionStatus?: SubscriptionStatus;
      quotaExhaustedAt?: null;
    } = { freeOrdersUsed: nextUsed };

    if (
      biz.subscriptionStatus === SubscriptionStatus.QUOTA_EXHAUSTED &&
      nextUsed < limit
    ) {
      updateData.subscriptionStatus = SubscriptionStatus.FREE;
      updateData.quotaExhaustedAt = null;
    }

    await tx.business.update({
      where: { id: biz.id },
      data: updateData,
    });
  });
}

/**
 * Reverse loyalty accrual for a refunded order (mirror accrueLoyaltyForPaidOrder).
 */
export async function reverseLoyaltyForRefundedOrder(orderId: number): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        businessId: true,
        total: true,
        buyerUserId: true,
        phone: true,
      },
    });
    if (order == null) return;

    const row = await prisma.loyaltyProgram.findUnique({
      where: { businessId: order.businessId },
    });
    const rules = normalizeLoyaltyRules(row ?? {});
    if (!rules.enabled) return;

    const customerKey = resolveCustomerKey({
      buyerUserId: order.buyerUserId,
      phone: order.phone,
    });
    if (customerKey === "anon") return;

    const points = computeLoyaltyAccrual(rules, { totalSom: order.total });
    if (points <= 0) return;

    const state = await prisma.customerLoyaltyState.findUnique({
      where: {
        businessId_customerKey: {
          businessId: order.businessId,
          customerKey,
        },
      },
    });
    if (state == null || state.lastOrderId !== orderId) return;

    await prisma.customerLoyaltyState.update({
      where: {
        businessId_customerKey: {
          businessId: order.businessId,
          customerKey,
        },
      },
      data: {
        points: Math.max(0, state.points - points),
        visits: Math.max(0, state.visits - 1),
        orders: Math.max(0, state.orders - 1),
        lastOrderId: null,
      },
    });
  } catch (e) {
    console.error("[reverseLoyaltyForRefundedOrder]", e);
  }
}

/** Post-refund side effects (quota + loyalty). Non-blocking for caller. */
export async function applyRefundReversals(orderId: number): Promise<void> {
  await reverseFreeOrderQuotaOnRefund(orderId);
  await reverseLoyaltyForRefundedOrder(orderId);
}
