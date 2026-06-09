/**
 * Merchant loyalty service (Phase 16.4).
 *
 * Loyalty program CRUD + per-customer balance + accrual on paid orders.
 * Accrual is invoked from the post-paid hook (onOrderPaidConfirmed) as an
 * additive, idempotent, non-blocking side effect. Never touches checkout.
 */

import { prisma } from "./db.js";
import {
  DEFAULT_LOYALTY_RULES,
  computeLoyaltyAccrual,
  normalizeLoyaltyRules,
  resolveLoyaltyTier,
  type LoyaltyProgramRules,
  type LoyaltyTier,
} from "../shared/loyaltyModel.js";
import { resolveCustomerKey } from "../shared/customerProfile.js";

const db = prisma as any;

export type LoyaltyProgramPayload = LoyaltyProgramRules;

export type LoyaltyCustomerRow = {
  customerKey: string;
  points: number;
  visits: number;
  orders: number;
  tier: LoyaltyTier;
};

export type MerchantLoyaltyPayload = {
  program: LoyaltyProgramPayload;
  enrolledCustomers: number;
  totalPointsIssued: number;
  topCustomers: LoyaltyCustomerRow[];
};

export async function getLoyaltyProgram(
  businessId: number,
): Promise<LoyaltyProgramRules> {
  const row = await db.loyaltyProgram.findUnique({ where: { businessId } });
  if (row == null) return { ...DEFAULT_LOYALTY_RULES };
  return normalizeLoyaltyRules(row);
}

export async function saveLoyaltyProgram(
  businessId: number,
  input: Partial<LoyaltyProgramRules>,
): Promise<LoyaltyProgramRules> {
  const rules = normalizeLoyaltyRules(input);
  await db.loyaltyProgram.upsert({
    where: { businessId },
    create: { businessId, ...rules },
    update: { ...rules },
  });
  return rules;
}

export async function buildMerchantLoyalty(input: {
  businessId: number;
}): Promise<MerchantLoyaltyPayload> {
  const [program, states] = await Promise.all([
    getLoyaltyProgram(input.businessId),
    db.customerLoyaltyState.findMany({
      where: { businessId: input.businessId },
      orderBy: { points: "desc" },
      take: 200,
    }),
  ]);

  const typedStates = states as Array<{
    customerKey: string;
    points: number;
    visits: number;
    orders: number;
  }>;

  const totalPointsIssued = typedStates.reduce((s, r) => s + r.points, 0);
  const topCustomers: LoyaltyCustomerRow[] = typedStates.slice(0, 10).map((r) => ({
    customerKey: r.customerKey,
    points: r.points,
    visits: r.visits,
    orders: r.orders,
    tier: resolveLoyaltyTier(r.points),
  }));

  return {
    program,
    enrolledCustomers: typedStates.length,
    totalPointsIssued,
    topCustomers,
  };
}

/**
 * Accrue loyalty points for a paid order. Idempotent via lastOrderId guard.
 * Safe to call from the post-paid hook; never throws to the caller.
 */
export async function accrueLoyaltyForPaidOrder(orderId: number): Promise<void> {
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

    const rules = await getLoyaltyProgram(order.businessId);
    if (!rules.enabled) return;

    const customerKey = resolveCustomerKey({
      buyerUserId: order.buyerUserId,
      phone: order.phone,
    });
    if (customerKey === "anon") return;

    const points = computeLoyaltyAccrual(rules, { totalSom: order.total });
    if (points <= 0) return;

    const existing = await db.customerLoyaltyState.findUnique({
      where: { businessId_customerKey: { businessId: order.businessId, customerKey } },
      select: { lastOrderId: true },
    });
    if (existing?.lastOrderId === orderId) return; // already counted

    await db.customerLoyaltyState.upsert({
      where: { businessId_customerKey: { businessId: order.businessId, customerKey } },
      create: {
        businessId: order.businessId,
        customerKey,
        points,
        visits: 1,
        orders: 1,
        lastOrderId: orderId,
      },
      update: {
        points: { increment: points },
        visits: { increment: 1 },
        orders: { increment: 1 },
        lastOrderId: orderId,
      },
    });
  } catch (e) {
    console.error("[accrueLoyaltyForPaidOrder]", e);
  }
}
