/**
 * Merchant promotion engine (Phase 16.1) — pure, deterministic, no AI.
 *
 * Defines promotion types, schedule checks, and discount evaluation against a
 * cart/customer context. This module computes preview/eligibility only. The
 * ONLY promotion type that is enforced at checkout is COUPON_PERCENT, which
 * bridges to the existing `Promo` table (see merchantMarketingService); all
 * other types are modeled/scheduled/surfaced without changing checkout math.
 */

import type { CustomerSegment } from "./customerProfile.js";

export type PromotionType =
  | "PERCENT"
  | "FIXED"
  | "FREE_DELIVERY"
  | "GIFT"
  | "BUY_X_GET_Y"
  | "COUPON_PERCENT"
  | "AUTOMATIC_PERCENT";

export type PromotionStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "ENDED";

/** How a promotion is triggered. */
export type PromotionTrigger = "COUPON" | "AUTOMATIC";

export type PromotionDefinition = {
  id?: number;
  businessId: number;
  type: PromotionType;
  title: string;
  /** Coupon code (required for COUPON_PERCENT). Stored uppercase. */
  code: string | null;
  /** Percent 0–100 (PERCENT, COUPON_PERCENT, AUTOMATIC_PERCENT). */
  percent: number | null;
  /** Fixed discount in som (FIXED). */
  fixedAmountSom: number | null;
  /** Minimum order subtotal in som to qualify. */
  minOrderSom: number;
  /** Gift product id (GIFT) or BUY_X_GET_Y reward product. */
  giftProductId: number | null;
  /** Buy X get Y quantities. */
  buyQuantity: number | null;
  getQuantity: number | null;
  /** Optional audience targeting (CRM segment). null = everyone. */
  audienceSegment: CustomerSegment | null;
  /** Inclusive ISO schedule window; null = open-ended. */
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  /** Total redemption cap (0 = unlimited). */
  maxRedemptions: number;
  redemptions: number;
};

export type PromotionContext = {
  subtotalSom: number;
  /** Customer CRM segment for audience matching. */
  customerSegment?: CustomerSegment | null;
  now?: Date;
};

export type PromotionEvaluation = {
  eligible: boolean;
  reason: string | null;
  discountSom: number;
  freeDelivery: boolean;
  giftProductId: number | null;
};

export const PROMOTION_TYPES: PromotionType[] = [
  "PERCENT",
  "FIXED",
  "FREE_DELIVERY",
  "GIFT",
  "BUY_X_GET_Y",
  "COUPON_PERCENT",
  "AUTOMATIC_PERCENT",
];

export function promotionTrigger(type: PromotionType): PromotionTrigger {
  return type === "COUPON_PERCENT" ? "COUPON" : "AUTOMATIC";
}

/** True when the promotion is within its (optional) schedule window. */
export function isPromotionActiveAt(
  promo: Pick<PromotionDefinition, "active" | "startsAt" | "endsAt">,
  now: Date = new Date(),
): boolean {
  if (!promo.active) return false;
  const t = now.getTime();
  if (promo.startsAt != null) {
    const start = new Date(promo.startsAt).getTime();
    if (Number.isFinite(start) && t < start) return false;
  }
  if (promo.endsAt != null) {
    const end = new Date(promo.endsAt).getTime();
    if (Number.isFinite(end) && t > end) return false;
  }
  return true;
}

/** Resolve display status from schedule + active flag + redemption cap. */
export function resolvePromotionStatus(
  promo: Pick<
    PromotionDefinition,
    "active" | "startsAt" | "endsAt" | "maxRedemptions" | "redemptions"
  >,
  now: Date = new Date(),
): PromotionStatus {
  if (!promo.active) return "DRAFT";
  if (promo.maxRedemptions > 0 && promo.redemptions >= promo.maxRedemptions) {
    return "ENDED";
  }
  const t = now.getTime();
  if (promo.startsAt != null) {
    const start = new Date(promo.startsAt).getTime();
    if (Number.isFinite(start) && t < start) return "SCHEDULED";
  }
  if (promo.endsAt != null) {
    const end = new Date(promo.endsAt).getTime();
    if (Number.isFinite(end) && t > end) return "ENDED";
  }
  return "ACTIVE";
}

function audienceMatches(
  promo: Pick<PromotionDefinition, "audienceSegment">,
  ctx: PromotionContext,
): boolean {
  if (promo.audienceSegment == null) return true;
  return ctx.customerSegment === promo.audienceSegment;
}

function ineligible(reason: string): PromotionEvaluation {
  return {
    eligible: false,
    reason,
    discountSom: 0,
    freeDelivery: false,
    giftProductId: null,
  };
}

/**
 * Deterministically evaluate a promotion against a cart context.
 * Returns the discount/gift/free-delivery effects (preview only).
 */
export function evaluatePromotion(
  promo: PromotionDefinition,
  ctx: PromotionContext,
): PromotionEvaluation {
  const now = ctx.now ?? new Date();
  if (!isPromotionActiveAt(promo, now)) return ineligible("INACTIVE");
  if (promo.maxRedemptions > 0 && promo.redemptions >= promo.maxRedemptions) {
    return ineligible("EXHAUSTED");
  }
  if (!audienceMatches(promo, ctx)) return ineligible("AUDIENCE");
  const subtotal = Number(ctx.subtotalSom) || 0;
  if (subtotal < promo.minOrderSom) return ineligible("MIN_ORDER");

  switch (promo.type) {
    case "PERCENT":
    case "COUPON_PERCENT":
    case "AUTOMATIC_PERCENT": {
      const pct = clampPercent(promo.percent);
      const discountSom = Math.round(subtotal * (pct / 100));
      return {
        eligible: true,
        reason: null,
        discountSom,
        freeDelivery: false,
        giftProductId: null,
      };
    }
    case "FIXED": {
      const fixed = Math.max(0, Math.round(promo.fixedAmountSom ?? 0));
      return {
        eligible: true,
        reason: null,
        discountSom: Math.min(fixed, subtotal),
        freeDelivery: false,
        giftProductId: null,
      };
    }
    case "FREE_DELIVERY":
      return {
        eligible: true,
        reason: null,
        discountSom: 0,
        freeDelivery: true,
        giftProductId: null,
      };
    case "GIFT":
      return {
        eligible: true,
        reason: null,
        discountSom: 0,
        freeDelivery: false,
        giftProductId: promo.giftProductId ?? null,
      };
    case "BUY_X_GET_Y":
      return {
        eligible: true,
        reason: null,
        discountSom: 0,
        freeDelivery: false,
        giftProductId: promo.giftProductId ?? null,
      };
    default:
      return ineligible("UNKNOWN_TYPE");
  }
}

function clampPercent(value: number | null): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export type PromotionValidationError =
  | "EMPTY_TITLE"
  | "BAD_PERCENT"
  | "BAD_FIXED"
  | "MISSING_CODE"
  | "BAD_BXGY"
  | "BAD_SCHEDULE";

/** Validate a promotion definition before persistence. Pure. */
export function validatePromotionDefinition(
  input: Partial<PromotionDefinition>,
): { ok: true } | { ok: false; error: PromotionValidationError } {
  if (typeof input.title !== "string" || input.title.trim() === "") {
    return { ok: false, error: "EMPTY_TITLE" };
  }
  const type = input.type;
  if (type === "PERCENT" || type === "COUPON_PERCENT" || type === "AUTOMATIC_PERCENT") {
    const pct = Number(input.percent);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      return { ok: false, error: "BAD_PERCENT" };
    }
  }
  if (type === "COUPON_PERCENT") {
    if (typeof input.code !== "string" || input.code.trim() === "") {
      return { ok: false, error: "MISSING_CODE" };
    }
  }
  if (type === "FIXED") {
    const fixed = Number(input.fixedAmountSom);
    if (!Number.isFinite(fixed) || fixed <= 0) {
      return { ok: false, error: "BAD_FIXED" };
    }
  }
  if (type === "BUY_X_GET_Y") {
    const buy = Number(input.buyQuantity);
    const get = Number(input.getQuantity);
    if (!Number.isInteger(buy) || buy < 1 || !Number.isInteger(get) || get < 1) {
      return { ok: false, error: "BAD_BXGY" };
    }
  }
  if (input.startsAt != null && input.endsAt != null) {
    const s = new Date(input.startsAt).getTime();
    const e = new Date(input.endsAt).getTime();
    if (Number.isFinite(s) && Number.isFinite(e) && e < s) {
      return { ok: false, error: "BAD_SCHEDULE" };
    }
  }
  return { ok: true };
}
