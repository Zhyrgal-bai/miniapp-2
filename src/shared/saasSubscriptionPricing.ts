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

/** Шаги customer journey для экрана trial (цены из реестра тарифов). */
export function buildTrialSubscriptionJourney(): SubscriptionJourneyStep[] {
  const monthly = SAAS_SUBSCRIPTION_PLANS.find((p) => p.code === "MONTHLY");
  const yearly = SAAS_SUBSCRIPTION_PLANS.find((p) => p.code === "YEARLY");
  const monthlySom = monthly?.amountSom ?? SAAS_SUBSCRIPTION_PRICE_30_D;
  const yearlySom = yearly?.amountSom ?? monthlySom * 12;
  const yearlySubtitle =
    yearly != null
      ? `${yearly.paidMonths} месяцев + ${yearly.bonusMonths} бесплатно`
      : "12 месяцев + 1 бесплатно";

  return [
    {
      id: "trial",
      icon: "🟢",
      title: "Пробный период",
      phase: "current",
    },
    {
      id: "first_month",
      icon: "💳",
      title: "Первый месяц",
      priceLabel: formatArchaPriceSom(SAAS_SUBSCRIPTION_PRICE_FIRST_MONTH),
      phase: "next",
    },
    {
      id: "standard",
      icon: "💎",
      title: "Стандарт",
      priceLabel: `${formatArchaPriceSom(monthlySom)} / месяц`,
      phase: "later",
    },
    {
      id: "yearly",
      icon: "⭐",
      title: "Годовая",
      subtitle: yearlySubtitle,
      priceLabel: formatArchaPriceSom(yearlySom),
      phase: "later",
    },
  ];
}
