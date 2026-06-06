/** Canonical business type ids (matches Prisma `BusinessType` enum). */
export const BUSINESS_TYPE_IDS = [
  "universal",
  "clothing",
  "coffee",
  "fastfood",
  "flowers",
] as const;

export type BusinessTypeId = (typeof BUSINESS_TYPE_IDS)[number];

export function isBusinessTypeId(v: unknown): v is BusinessTypeId {
  return typeof v === "string" && (BUSINESS_TYPE_IDS as readonly string[]).includes(v);
}

/** Registration / provision: unknown values fall back to clothing (legacy compat). */
export function normalizeProvisionBusinessType(raw: unknown): BusinessTypeId {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return isBusinessTypeId(v) ? v : "clothing";
}

export const BUSINESS_TYPE_REGISTRATION_CARDS: Array<{
  id: BusinessTypeId;
  emoji: string;
  label: string;
  description: string;
}> = [
  {
    id: "universal",
    emoji: "🌍",
    label: "Универсальный магазин",
    description: "Подходит для большинства видов бизнеса. Гибкая настройка товаров и каталога.",
  },
  {
    id: "clothing",
    emoji: "👕",
    label: "Одежда",
    description: "Размеры, цвета, варианты и fashion-карточки",
  },
  {
    id: "coffee",
    emoji: "☕",
    label: "Кофейня",
    description: "Напитки, опции заказа и быстрый pickup",
  },
  {
    id: "fastfood",
    emoji: "🍔",
    label: "Фастфуд",
    description: "Комбо, модификаторы и доставка еды",
  },
  {
    id: "flowers",
    emoji: "🌸",
    label: "Цветочный",
    description: "Букеты, дата доставки и подарочная упаковка",
  },
];
