/** Цены SaaS-подписки — синхрон с `saasBillingService.ts`. */
export const SAAS_SUBSCRIPTION_PRICE_30_D = 5500;
export const SAAS_SUBSCRIPTION_PRICE_90_D = SAAS_SUBSCRIPTION_PRICE_30_D * 3;

export type SaasSubscriptionPlanDays = 30 | 90;

export const SAAS_SUBSCRIPTION_PLANS: ReadonlyArray<{
  days: SaasSubscriptionPlanDays;
  title: string;
  subtitle: string;
  amountSom: number;
  badge?: string;
  featured?: boolean;
}> = [
  {
    days: 30,
    title: "30 дней",
    subtitle: "Месяц подписки",
    amountSom: SAAS_SUBSCRIPTION_PRICE_30_D,
  },
  {
    days: 90,
    title: "90 дней",
    subtitle: "Квартал без лишних продлений",
    amountSom: SAAS_SUBSCRIPTION_PRICE_90_D,
    badge: "Меньше платежей",
    featured: true,
  },
];

export function formatSaasPriceSom(amount: number): string {
  return `${amount.toLocaleString("ru-RU")} сом`;
}

export function saasPricePerDayLabel(amountSom: number, days: number): string {
  const perDay = Math.round(amountSom / days);
  return `~${perDay.toLocaleString("ru-RU")} сом/день`;
}
