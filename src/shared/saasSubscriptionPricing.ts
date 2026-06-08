/**
 * @deprecated Импортируйте из `archaSubscriptionPlans.ts`.
 * Оставлено для совместимости с frontend `@repo-shared/saasSubscriptionPricing`.
 */
import {
  ARCHA_FIRST_MONTH_PRICE_SOM,
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

/** Промо-цена первого месяца после trial (legacy 20 дней). */
export const SAAS_SUBSCRIPTION_PRICE_FIRST_MONTH = ARCHA_FIRST_MONTH_PRICE_SOM;

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
  bonusDays: p.bonusDays ?? 0,
  totalMonths: p.paidMonths + p.bonusMonths,
  badge: p.badge,
  featured: p.featured,
  popular: p.popular,
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
  ARCHA_FIRST_MONTH_PRICE_SOM,
  parseArchaSubscriptionPlanCode,
} from "./archaSubscriptionPlans.js";

export type SubscriptionJourneyStep = {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  priceLabel?: string;
  phase: "current" | "next" | "later";
};

/** @deprecated Journey больше не используется в UI подписки. */
export function buildTrialSubscriptionJourney(): SubscriptionJourneyStep[] {
  const monthly = SAAS_SUBSCRIPTION_PLANS.find((p) => p.code === "MONTHLY");
  const three = SAAS_SUBSCRIPTION_PLANS.find((p) => p.code === "THREE_MONTH");
  const yearly = SAAS_SUBSCRIPTION_PLANS.find((p) => p.code === "YEARLY");
  const monthlySom = monthly?.amountSom ?? SAAS_SUBSCRIPTION_PRICE_30_D;

  return [
    {
      id: "first_month",
      icon: "🥉",
      title: "Первый месяц",
      priceLabel: formatArchaPriceSom(SAAS_SUBSCRIPTION_PRICE_FIRST_MONTH),
      phase: "current",
    },
    {
      id: "standard",
      icon: "📅",
      title: "Стандарт",
      priceLabel: `${formatArchaPriceSom(monthlySom)} / месяц`,
      phase: "current",
    },
    {
      id: "three_month",
      icon: "🥈",
      title: "3 месяца",
      phase: "current",
      ...(three?.subtitle != null ? { subtitle: three.subtitle } : {}),
      ...(three != null
        ? { priceLabel: formatArchaPriceSom(three.amountSom) }
        : {}),
    },
    {
      id: "yearly",
      icon: "💎",
      title: "Годовой",
      phase: "current",
      ...(yearly?.subtitle != null ? { subtitle: yearly.subtitle } : {}),
      ...(yearly != null
        ? { priceLabel: formatArchaPriceSom(yearly.amountSom) }
        : {}),
    },
  ];
}
