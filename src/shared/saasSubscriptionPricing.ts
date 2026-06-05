/**
 * @deprecated Импортируйте из `archaSubscriptionPlans.ts`.
 * Оставлено для совместимости с frontend `@repo-shared/saasSubscriptionPricing`.
 */
import {
  ARCHA_SUBSCRIPTION_PLANS,
  type ArchaSubscriptionPlanCode,
  formatArchaPriceSom,
  archaPricePerMonthLabel,
  legacyPlanDaysToCode,
  planSpecForCode,
} from "./archaSubscriptionPlans.js";

export type SaasSubscriptionPlanDays = 30 | 90;

export const SAAS_SUBSCRIPTION_PRICE_30_D =
  ARCHA_SUBSCRIPTION_PLANS.find((p) => p.code === "MONTHLY")?.amountSom ?? 5500;

export const SAAS_SUBSCRIPTION_PRICE_90_D =
  ARCHA_SUBSCRIPTION_PLANS.find((p) => p.code === "HALF_YEAR")?.amountSom ??
  SAAS_SUBSCRIPTION_PRICE_30_D * 6;

export const SAAS_SUBSCRIPTION_PLANS = ARCHA_SUBSCRIPTION_PLANS.map((p) => ({
  code: p.code as ArchaSubscriptionPlanCode,
  title: p.title,
  subtitle: p.subtitle,
  amountSom: p.amountSom,
  paidMonths: p.paidMonths,
  bonusMonths: p.bonusMonths,
  totalMonths: p.paidMonths + p.bonusMonths,
  badge: p.badge,
  featured: p.featured,
}));

export function formatSaasPriceSom(amount: number): string {
  return formatArchaPriceSom(amount);
}

export function saasPricePerDayLabel(amountSom: number, months: number): string {
  return archaPricePerMonthLabel(amountSom, months);
}

export function saasPlanSpecFromLegacyDays(plan: SaasSubscriptionPlanDays) {
  return planSpecForCode(legacyPlanDaysToCode(plan));
}

export type { ArchaSubscriptionPlanCode } from "./archaSubscriptionPlans.js";
export {
  ARCHA_SUBSCRIPTION_PLANS,
  ARCHA_SUBSCRIPTION_GRACE_DAYS,
  parseArchaSubscriptionPlanCode,
} from "./archaSubscriptionPlans.js";
