/**
 * Merchant marketing presenters (Phase 16.7) — pure functions for the UI.
 * No API calls; mirrors the customerCrm presenter pattern.
 */

import type {
  MarketingCampaignStatus,
  MarketingPromotionStatus,
  MarketingPromotionType,
} from "../services/admin.service";

export type StatusTone = "gray" | "blue" | "green" | "amber" | "red";

const PROMOTION_STATUS_LABELS: Record<
  MarketingPromotionStatus,
  { label: string; tone: StatusTone }
> = {
  DRAFT: { label: "Черновик", tone: "gray" },
  SCHEDULED: { label: "Запланирована", tone: "blue" },
  ACTIVE: { label: "Активна", tone: "green" },
  PAUSED: { label: "Пауза", tone: "amber" },
  ENDED: { label: "Завершена", tone: "red" },
};

const CAMPAIGN_STATUS_LABELS: Record<
  MarketingCampaignStatus,
  { label: string; tone: StatusTone }
> = {
  DRAFT: { label: "Черновик", tone: "gray" },
  SCHEDULED: { label: "Запланирована", tone: "blue" },
  ACTIVE: { label: "Активна", tone: "green" },
  PAUSED: { label: "Пауза", tone: "amber" },
  ENDED: { label: "Завершена", tone: "red" },
};

const PROMOTION_TYPE_LABELS: Record<MarketingPromotionType, string> = {
  PERCENT: "Скидка %",
  FIXED: "Фикс. скидка",
  FREE_DELIVERY: "Бесплатная доставка",
  GIFT: "Подарок",
  BUY_X_GET_Y: "Купи X — получи Y",
  COUPON_PERCENT: "Промокод %",
  AUTOMATIC_PERCENT: "Авто-скидка %",
};

export const MARKETING_PROMOTION_TYPE_OPTIONS: Array<{
  id: MarketingPromotionType;
  label: string;
}> = (Object.keys(PROMOTION_TYPE_LABELS) as MarketingPromotionType[]).map((id) => ({
  id,
  label: PROMOTION_TYPE_LABELS[id],
}));

export function promotionStatusBadge(status: MarketingPromotionStatus): {
  label: string;
  tone: StatusTone;
} {
  return PROMOTION_STATUS_LABELS[status] ?? { label: status, tone: "gray" };
}

export function campaignStatusBadge(status: MarketingCampaignStatus): {
  label: string;
  tone: StatusTone;
} {
  return CAMPAIGN_STATUS_LABELS[status] ?? { label: status, tone: "gray" };
}

export function promotionTypeLabel(type: MarketingPromotionType): string {
  return PROMOTION_TYPE_LABELS[type] ?? type;
}

export function formatPromotionValue(promo: {
  type: MarketingPromotionType;
  percent: number | null;
  fixedAmountSom: number | null;
}): string {
  if (promo.type === "FIXED") {
    return `${Math.round(promo.fixedAmountSom ?? 0)} сом`;
  }
  if (promo.type === "FREE_DELIVERY") return "Доставка 0 сом";
  if (promo.type === "GIFT") return "Подарок";
  if (promo.type === "BUY_X_GET_Y") return "X+Y";
  if (promo.percent != null) return `${promo.percent}%`;
  return "—";
}

export function formatRoi(roi: number | null | undefined): string {
  if (roi == null || !Number.isFinite(roi)) return "—";
  return `${roi}x`;
}

export function formatBudget(budgetSom: number | null | undefined): string {
  const n = Number(budgetSom);
  if (!Number.isFinite(n) || n <= 0) return "Без бюджета";
  return `${Math.round(n)}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " сом";
}
