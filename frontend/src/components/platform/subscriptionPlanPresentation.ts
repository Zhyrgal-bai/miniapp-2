import type {
  MerchantSubscriptionPlanCode,
  MerchantSubscriptionPlanDTO,
} from "../../services/platformApi";

export type PlanRibbon = "popular" | "best";

export type PlanPresentation = {
  icon: string;
  perks: string[];
  priceSuffix?: string;
  ribbon?: PlanRibbon;
};

const PLAN_PRESENTATION: Record<
  MerchantSubscriptionPlanCode,
  Omit<PlanPresentation, "perks"> & { perks?: string[] }
> = {
  FIRST_MONTH: {
    icon: "🥉",
    perks: ["Для новых магазинов", "1 месяц доступа"],
  },
  MONTHLY: {
    icon: "📅",
    perks: ["Полный доступ", "Автопродление"],
    priceSuffix: "/ месяц",
  },
  THREE_MONTH: {
    icon: "🥈",
    perks: [],
    ribbon: "popular",
  },
  YEARLY: {
    icon: "💎",
    perks: [],
    ribbon: "best",
  },
};

export const PLAN_DISPLAY_ORDER: MerchantSubscriptionPlanCode[] = [
  "FIRST_MONTH",
  "MONTHLY",
  "THREE_MONTH",
  "YEARLY",
];

export function sortSubscriptionPlans(
  plans: MerchantSubscriptionPlanDTO[],
): MerchantSubscriptionPlanDTO[] {
  return [...plans].sort(
    (a, b) =>
      PLAN_DISPLAY_ORDER.indexOf(a.code) - PLAN_DISPLAY_ORDER.indexOf(b.code),
  );
}

function buildThreeMonthPerks(plan: MerchantSubscriptionPlanDTO): string[] {
  const perks: string[] = [];
  if (plan.badge) perks.push(plan.badge);
  if (plan.bonusDays > 0) {
    perks.push(`+${plan.bonusDays} дней бонус`);
  }
  if (perks.length === 0 && plan.subtitle) perks.push(plan.subtitle);
  return perks;
}

function buildYearlyPerks(plan: MerchantSubscriptionPlanDTO): string[] {
  const perks: string[] = [];
  if (plan.badge) perks.push(plan.badge);
  if (plan.bonusMonths > 0) {
    perks.push(
      `+${plan.bonusMonths} ${plan.bonusMonths === 1 ? "месяц" : "месяца"} бесплатно`,
    );
  }
  if (perks.length === 0 && plan.subtitle) perks.push(plan.subtitle);
  return perks;
}

export function planPresentation(
  plan: MerchantSubscriptionPlanDTO,
): PlanPresentation {
  const base = PLAN_PRESENTATION[plan.code];

  if (plan.code === "THREE_MONTH") {
    return {
      icon: base.icon,
      perks: buildThreeMonthPerks(plan),
      ribbon: plan.popular ? "popular" : base.ribbon,
    };
  }

  if (plan.code === "YEARLY") {
    return {
      icon: base.icon,
      perks: buildYearlyPerks(plan),
      ribbon: plan.featured ? "best" : base.ribbon,
    };
  }

  const perks =
    base.perks != null && base.perks.length > 0
      ? base.perks
      : plan.subtitle
        ? [plan.subtitle]
        : [];

  return {
    icon: base.icon,
    perks,
    priceSuffix: base.priceSuffix,
    ribbon: plan.featured ? "best" : plan.popular ? "popular" : base.ribbon,
  };
}

export function ribbonLabel(ribbon: PlanRibbon): string {
  return ribbon === "popular" ? "Популярный" : "Лучшее предложение";
}
