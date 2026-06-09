/**
 * Merchant loyalty model (Phase 16.4) — pure, deterministic, simple.
 *
 * Defines accrual rules (points per paid order / per spend), tier resolution,
 * and redemption math. Accrual is invoked from the post-paid hook; this module
 * never touches checkout or payment logic.
 */

export type LoyaltyProgramRules = {
  enabled: boolean;
  /** Points granted per paid order. */
  pointsPerOrder: number;
  /** Points granted per N som spent (0 disables spend accrual). */
  pointsPerSomSpent: number;
  /** Points needed to redeem one reward unit (0 disables redemption). */
  redeemThreshold: number;
  /** Discount som granted per reward unit on redemption. */
  redeemValueSom: number;
};

export type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum";

export type LoyaltyState = {
  points: number;
  visits: number;
  orders: number;
};

export const DEFAULT_LOYALTY_RULES: LoyaltyProgramRules = {
  enabled: false,
  pointsPerOrder: 10,
  pointsPerSomSpent: 0,
  redeemThreshold: 100,
  redeemValueSom: 100,
};

export const LOYALTY_TIER_THRESHOLDS: Record<LoyaltyTier, number> = {
  bronze: 0,
  silver: 200,
  gold: 500,
  platinum: 1000,
};

/** Points earned for a single paid order under the given rules. */
export function computeLoyaltyAccrual(
  rules: LoyaltyProgramRules,
  order: { totalSom: number },
): number {
  if (!rules.enabled) return 0;
  let points = Math.max(0, Math.round(rules.pointsPerOrder));
  if (rules.pointsPerSomSpent > 0) {
    const spendUnits = Math.floor(
      (Number(order.totalSom) || 0) / rules.pointsPerSomSpent,
    );
    if (spendUnits > 0) points += spendUnits;
  }
  return points;
}

/** Resolve the loyalty tier for a points balance. */
export function resolveLoyaltyTier(points: number): LoyaltyTier {
  const p = Number(points) || 0;
  if (p >= LOYALTY_TIER_THRESHOLDS.platinum) return "platinum";
  if (p >= LOYALTY_TIER_THRESHOLDS.gold) return "gold";
  if (p >= LOYALTY_TIER_THRESHOLDS.silver) return "silver";
  return "bronze";
}

/** Maximum redeemable discount (som) for a points balance. */
export function computeRedeemableValueSom(
  rules: LoyaltyProgramRules,
  points: number,
): number {
  if (!rules.enabled || rules.redeemThreshold <= 0 || rules.redeemValueSom <= 0) {
    return 0;
  }
  const units = Math.floor((Number(points) || 0) / rules.redeemThreshold);
  return Math.max(0, units * rules.redeemValueSom);
}

export type LoyaltyRulesValidationError =
  | "BAD_POINTS_PER_ORDER"
  | "BAD_POINTS_PER_SOM"
  | "BAD_REDEEM";

export function validateLoyaltyRules(
  input: Partial<LoyaltyProgramRules>,
): { ok: true } | { ok: false; error: LoyaltyRulesValidationError } {
  const ppo = Number(input.pointsPerOrder ?? DEFAULT_LOYALTY_RULES.pointsPerOrder);
  if (!Number.isFinite(ppo) || ppo < 0) {
    return { ok: false, error: "BAD_POINTS_PER_ORDER" };
  }
  const pps = Number(input.pointsPerSomSpent ?? 0);
  if (!Number.isFinite(pps) || pps < 0) {
    return { ok: false, error: "BAD_POINTS_PER_SOM" };
  }
  const threshold = Number(input.redeemThreshold ?? 0);
  const value = Number(input.redeemValueSom ?? 0);
  if (!Number.isFinite(threshold) || threshold < 0 || !Number.isFinite(value) || value < 0) {
    return { ok: false, error: "BAD_REDEEM" };
  }
  return { ok: true };
}

export function normalizeLoyaltyRules(
  input: Partial<LoyaltyProgramRules> | null | undefined,
): LoyaltyProgramRules {
  const src = input ?? {};
  return {
    enabled: src.enabled === true,
    pointsPerOrder: Math.max(0, Math.round(Number(src.pointsPerOrder ?? DEFAULT_LOYALTY_RULES.pointsPerOrder))),
    pointsPerSomSpent: Math.max(0, Math.round(Number(src.pointsPerSomSpent ?? 0))),
    redeemThreshold: Math.max(0, Math.round(Number(src.redeemThreshold ?? DEFAULT_LOYALTY_RULES.redeemThreshold))),
    redeemValueSom: Math.max(0, Math.round(Number(src.redeemValueSom ?? DEFAULT_LOYALTY_RULES.redeemValueSom))),
  };
}
