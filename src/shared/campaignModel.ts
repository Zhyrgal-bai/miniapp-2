/**
 * Merchant campaign model (Phase 16.3) — pure, deterministic.
 *
 * A campaign wraps a promotion with an audience (CRM segment), schedule,
 * budget and status. Status is derived deterministically from active flag +
 * schedule window; stats/ROI are computed from attributed orders.
 */

import type { CustomerSegment } from "./customerProfile.js";

export type CampaignStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ACTIVE"
  | "PAUSED"
  | "ENDED";

export type CampaignDefinition = {
  id?: number;
  businessId: number;
  title: string;
  promotionId: number | null;
  audienceSegment: CustomerSegment | null;
  startsAt: string | null;
  endsAt: string | null;
  /** Marketing budget in som (0 = none). Used for ROI denominator. */
  budgetSom: number;
  /** Merchant pause flag — overrides schedule to PAUSED. */
  paused: boolean;
  active: boolean;
};

export type CampaignStats = {
  reach: number;
  redemptions: number;
  attributedRevenueSom: number;
  attributedDiscountSom: number;
  /** ROI = attributed revenue / budget (null when no budget). */
  roi: number | null;
};

/** Deterministic campaign status from flags + schedule window. */
export function resolveCampaignStatus(
  campaign: Pick<
    CampaignDefinition,
    "active" | "paused" | "startsAt" | "endsAt"
  >,
  now: Date = new Date(),
): CampaignStatus {
  if (!campaign.active) return "DRAFT";
  if (campaign.paused) return "PAUSED";
  const t = now.getTime();
  if (campaign.startsAt != null) {
    const start = new Date(campaign.startsAt).getTime();
    if (Number.isFinite(start) && t < start) return "SCHEDULED";
  }
  if (campaign.endsAt != null) {
    const end = new Date(campaign.endsAt).getTime();
    if (Number.isFinite(end) && t > end) return "ENDED";
  }
  return "ACTIVE";
}

export function isCampaignRunning(
  campaign: Pick<CampaignDefinition, "active" | "paused" | "startsAt" | "endsAt">,
  now: Date = new Date(),
): boolean {
  return resolveCampaignStatus(campaign, now) === "ACTIVE";
}

/** Compute ROI ratio (revenue / budget), rounded to 0.1; null without budget. */
export function computeCampaignRoi(
  attributedRevenueSom: number,
  budgetSom: number,
): number | null {
  if (!Number.isFinite(budgetSom) || budgetSom <= 0) return null;
  const revenue = Number(attributedRevenueSom) || 0;
  return Math.round((revenue / budgetSom) * 10) / 10;
}

export type CampaignStatValidationError = "EMPTY_TITLE" | "BAD_BUDGET" | "BAD_SCHEDULE";

export function validateCampaignDefinition(
  input: Partial<CampaignDefinition>,
): { ok: true } | { ok: false; error: CampaignStatValidationError } {
  if (typeof input.title !== "string" || input.title.trim() === "") {
    return { ok: false, error: "EMPTY_TITLE" };
  }
  if (input.budgetSom != null) {
    const b = Number(input.budgetSom);
    if (!Number.isFinite(b) || b < 0) return { ok: false, error: "BAD_BUDGET" };
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
