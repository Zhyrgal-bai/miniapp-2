export type StorefrontKitId = "minimal" | "luxury" | "fashion" | "neon" | "default";

export type BusinessBehaviorProfile = {
  id: string;
  cta: {
    labels: {
      add: string;
      inCart: string;
      buyNow: string;
      selectOptions: string;
      outOfStock: string;
      lowStockPrefix: string; // e.g. "Осталось"
      popularToday: string;
    };
    lowStockThreshold: number;
    preferBuyNow: boolean;
  };
  motion: { intensity: "disabled" | "subtle" | "smooth" | "energetic" };
};

const BASE: BusinessBehaviorProfile = {
  id: "default",
  cta: {
    labels: {
      add: "Добавить",
      inCart: "Уже в корзине",
      buyNow: "Купить сейчас",
      selectOptions: "Выберите вариант",
      outOfStock: "Нет в наличии",
      lowStockPrefix: "Осталось",
      popularToday: "Популярно сегодня",
    },
    lowStockThreshold: 5,
    preferBuyNow: false,
  },
  motion: { intensity: "smooth" },
};

export const BUSINESS_BEHAVIOR_PROFILES: Record<string, BusinessBehaviorProfile> = {
  default: BASE,
  fashion: {
    ...BASE,
    id: "fashion",
    cta: {
      ...BASE.cta,
      labels: {
        ...BASE.cta.labels,
        add: "Добавить",
        buyNow: "Купить сейчас",
        popularToday: "В тренде сегодня",
      },
      lowStockThreshold: 4,
      preferBuyNow: true,
    },
    motion: { intensity: "energetic" },
  },
  fastfood: {
    ...BASE,
    id: "fastfood",
    cta: {
      ...BASE.cta,
      labels: {
        ...BASE.cta.labels,
        add: "Добавить",
        buyNow: "Заказать сейчас",
      },
      lowStockThreshold: 3,
      preferBuyNow: false,
    },
    motion: { intensity: "snappy" as unknown as BusinessBehaviorProfile["motion"]["intensity"] },
  },
  flowers: {
    ...BASE,
    id: "flowers",
    cta: {
      ...BASE.cta,
      labels: {
        ...BASE.cta.labels,
        add: "Добавить",
        buyNow: "Купить букет",
      },
      lowStockThreshold: 4,
      preferBuyNow: true,
    },
    motion: { intensity: "subtle" },
  },
  coffee: {
    ...BASE,
    id: "coffee",
    cta: { ...BASE.cta, lowStockThreshold: 4 },
    motion: { intensity: "subtle" },
  },
  clothing: {
    ...BASE,
    id: "clothing",
    cta: { ...BASE.cta, preferBuyNow: true },
    motion: { intensity: "smooth" },
  },
};

export function profileForBusinessType(businessType: string | null | undefined): BusinessBehaviorProfile {
  const key = typeof businessType === "string" ? businessType.trim().toLowerCase() : "";
  return BUSINESS_BEHAVIOR_PROFILES[key] ?? BUSINESS_BEHAVIOR_PROFILES.default!;
}

