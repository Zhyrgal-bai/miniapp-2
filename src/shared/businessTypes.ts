/** Legacy runtime type kept only for backward compatibility/migration. */
export const LEGACY_BUSINESS_TYPE_IDS = ["universal"] as const;

/** Target type set for new stores. */
export const TARGET_BUSINESS_TYPE_IDS = [
  "clothing",
  "flowers",
  "coffee",
  "fastfood",
  "electronics",
  "autoparts",
  "cosmetics",
  "furniture",
] as const;

/** Canonical DB ids (matches Prisma `BusinessType` enum, includes legacy). */
export const BUSINESS_TYPE_IDS = [
  ...LEGACY_BUSINESS_TYPE_IDS,
  ...TARGET_BUSINESS_TYPE_IDS,
] as const;

export type BusinessTypeId = (typeof BUSINESS_TYPE_IDS)[number];
export type TargetBusinessTypeId = (typeof TARGET_BUSINESS_TYPE_IDS)[number];

export function isBusinessTypeId(v: unknown): v is BusinessTypeId {
  return (
    typeof v === "string" &&
    (BUSINESS_TYPE_IDS as readonly string[]).includes(v)
  );
}

export function isTargetBusinessTypeId(v: unknown): v is TargetBusinessTypeId {
  return (
    typeof v === "string" &&
    (TARGET_BUSINESS_TYPE_IDS as readonly string[]).includes(v)
  );
}

/** Registration/provision: unknown values fall back to clothing (legacy compat). */
export function normalizeProvisionBusinessType(raw: unknown): BusinessTypeId {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return isBusinessTypeId(v) ? v : "clothing";
}

/** New registrations must use target verticals only. */
export function normalizeRegistrationBusinessType(raw: unknown): TargetBusinessTypeId {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return isTargetBusinessTypeId(v) ? v : "clothing";
}

export const BUSINESS_TYPE_REGISTRATION_CARDS: Array<{
  id: TargetBusinessTypeId;
  emoji: string;
  label: string;
  description: string;
}> = [
  {
    id: "clothing",
    emoji: "👕",
    label: "Одежда",
    description: "Размеры, цвета, варианты и fashion-карточки",
  },
  {
    id: "flowers",
    emoji: "🌸",
    label: "Цветы",
    description: "Букеты, дата доставки и подарочная упаковка",
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
    id: "electronics",
    emoji: "📱",
    label: "Электроника",
    description: "Характеристики, комплектация и гарантийные атрибуты",
  },
  {
    id: "autoparts",
    emoji: "🚗",
    label: "Автозапчасти",
    description: "Совместимость, VIN/модель и технические параметры",
  },
  {
    id: "cosmetics",
    emoji: "💄",
    label: "Косметика",
    description: "Состав, объём, тип кожи и бьюти-категории",
  },
  {
    id: "furniture",
    emoji: "🛋️",
    label: "Мебель",
    description: "Габариты, материалы и варианты исполнения",
  },
];
