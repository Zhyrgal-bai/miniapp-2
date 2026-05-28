import type { BusinessType } from "@prisma/client";

export type VerticalInventoryMode =
  | "sku_matrix"
  | "single_axis"
  | "metadata_only";

export type VerticalCommerceProfile = {
  businessType: BusinessType;
  inventoryMode: VerticalInventoryMode;
  /** Maps to OrderItem.size / ProductStock.size (storage adapter) */
  primaryAxisKey: "size";
  primaryAxisLabel: string;
  /** Maps to OrderItem.color; null = hide secondary picker */
  secondaryAxisKey: "color" | null;
  secondaryAxisLabel: string | null;
  showFashionVariantMatrix: boolean;
  showOrderOptionsOnStorefront: boolean;
  variantEditor: "clothing_matrix" | "tier_stock" | "bouquet_tiers" | "none";
  defaultPrimaryValues: string[];
  cardPlaceholder: string;
};

export const VERTICAL_PROFILES: Record<BusinessType, VerticalCommerceProfile> = {
  clothing: {
    businessType: "clothing",
    inventoryMode: "sku_matrix",
    primaryAxisKey: "size",
    primaryAxisLabel: "Размер",
    secondaryAxisKey: "color",
    secondaryAxisLabel: "Цвет",
    showFashionVariantMatrix: true,
    showOrderOptionsOnStorefront: false,
    variantEditor: "clothing_matrix",
    defaultPrimaryValues: [],
    cardPlaceholder: "Выберите размер и цвет",
  },
  coffee: {
    businessType: "coffee",
    inventoryMode: "single_axis",
    primaryAxisKey: "size",
    primaryAxisLabel: "Объём",
    secondaryAxisKey: null,
    secondaryAxisLabel: null,
    showFashionVariantMatrix: false,
    showOrderOptionsOnStorefront: true,
    variantEditor: "tier_stock",
    defaultPrimaryValues: [],
    cardPlaceholder: "350 мл • горячий",
  },
  flowers: {
    businessType: "flowers",
    inventoryMode: "single_axis",
    primaryAxisKey: "size",
    primaryAxisLabel: "Букет",
    secondaryAxisKey: null,
    secondaryAxisLabel: null,
    showFashionVariantMatrix: false,
    showOrderOptionsOnStorefront: true,
    variantEditor: "bouquet_tiers",
    defaultPrimaryValues: [],
    cardPlaceholder: "21 роза",
  },
  fastfood: {
    businessType: "fastfood",
    inventoryMode: "single_axis",
    primaryAxisKey: "size",
    primaryAxisLabel: "Порция",
    secondaryAxisKey: null,
    secondaryAxisLabel: null,
    showFashionVariantMatrix: false,
    showOrderOptionsOnStorefront: true,
    variantEditor: "tier_stock",
    defaultPrimaryValues: [],
    cardPlaceholder: "Средняя порция",
  },
};

/** Safe profile when businessType is missing — no clothing assumptions. */
export const UNKNOWN_VERTICAL_PROFILE: VerticalCommerceProfile = {
  businessType: "clothing",
  inventoryMode: "metadata_only",
  primaryAxisKey: "size",
  primaryAxisLabel: "Вариант",
  secondaryAxisKey: null,
  secondaryAxisLabel: null,
  showFashionVariantMatrix: false,
  showOrderOptionsOnStorefront: false,
  variantEditor: "none",
  defaultPrimaryValues: [],
  cardPlaceholder: "Выберите параметры",
};

const KNOWN_BUSINESS_TYPES = new Set<string>(
  Object.keys(VERTICAL_PROFILES),
);

export function isKnownBusinessType(
  businessType: string | null | undefined,
): businessType is BusinessType {
  const key = String(businessType ?? "").trim();
  return key !== "" && KNOWN_BUSINESS_TYPES.has(key);
}

export function verticalProfileFor(
  businessType: string | null | undefined,
): VerticalCommerceProfile {
  const key = String(businessType ?? "").trim();
  if (key !== "" && VERTICAL_PROFILES[key as BusinessType]) {
    return VERTICAL_PROFILES[key as BusinessType];
  }
  if (key !== "" && typeof console !== "undefined") {
    console.warn(
      `[vertical] unknown businessType "${key}" — using neutral profile (no apparel defaults)`,
    );
  }
  return UNKNOWN_VERTICAL_PROFILE;
}

export function verticalUsesColorAxis(
  businessType: string | null | undefined,
): boolean {
  if (!isKnownBusinessType(businessType)) return false;
  return VERTICAL_PROFILES[businessType].secondaryAxisKey === "color";
}

export const HOT_OR_COLD_RU: Record<string, string> = {
  hot: "Горячий",
  ice: "Холодный",
};

export const SUGAR_RU: Record<string, string> = {
  no: "Без сахара",
  less: "Меньше сахара",
  normal: "Обычный",
};

export const SPICY_RU: Record<string, string> = {
  no: "Не острое",
  mild: "Средняя острота",
  hot: "Острое",
};

export const SYRUP_RU: Record<string, string> = {
  vanilla: "Ваниль",
  caramel: "Карамель",
  hazelnut: "Фундук",
};

export const ADDON_RU: Record<string, string> = {
  cheese: "Сыр",
  bacon: "Бекон",
  sauce: "Соус",
};

export const PACKAGING_RU: Record<string, string> = {
  paper: "Бумага",
  box: "Коробка",
};

export const FASTFOOD_PORTION_LABELS: Record<string, string> = {
  S: "Маленькая порция",
  M: "Средняя порция",
  L: "Большая порция",
};

export function formatFlowerStemCount(count: string): string {
  const raw = String(count ?? "").trim();
  if (raw === "") return "";
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return raw;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} роз`;
  if (mod10 === 1) return `${n} роза`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} розы`;
  return `${n} роз`;
}

export const FLOWER_TIER_LABELS: Record<string, string> = {
  "3": "3 розы",
  "5": "5 роз",
  "7": "7 роз",
  "11": "11 роз",
  "21": "21 роза",
  "51": "51 роза",
  "101": "101 роза",
};

export function formatVolumeLabel(value: string): string {
  const v = String(value ?? "").trim();
  const m = /^(\d+)\s*ml$/i.exec(v);
  if (m) return `${m[1]} мл`;
  return v;
}

export function labelPrimaryOption(
  businessType: string | null | undefined,
  value: string,
): string {
  const v = String(value ?? "").trim();
  if (v === "") return "";
  if (!isKnownBusinessType(businessType)) return v;

  switch (businessType) {
    case "flowers":
      return FLOWER_TIER_LABELS[v] ?? formatFlowerStemCount(v);
    case "coffee":
      return formatVolumeLabel(v);
    case "fastfood":
      return FASTFOOD_PORTION_LABELS[v] ?? v;
    default:
      return v;
  }
}

function pickAttrString(attrs: Record<string, unknown>, key: string): string {
  const val = attrs[key];
  if (typeof val === "string" && val.trim() !== "") return val.trim();
  if (Array.isArray(val) && typeof val[0] === "string") return val[0].trim();
  return "";
}

function normalizeColorDisplay(color: string): string {
  const c = String(color ?? "").trim();
  if (c === "" || c === "default") return "";
  return c;
}

/** Human-readable order-option fragment (from OrderItem.options JSON). */
export function formatOrderOptionsSummary(
  businessType: string | null | undefined,
  options: Record<string, unknown> | null | undefined,
): string {
  if (!options || typeof options !== "object") return "";
  const parts: string[] = [];

  if (isKnownBusinessType(businessType)) {
    switch (businessType) {
      case "coffee": {
        const temp = pickAttrString(options, "hotOrCold");
        if (temp) parts.push(HOT_OR_COLD_RU[temp] ?? temp);
        const sugar = pickAttrString(options, "sugar");
        if (sugar) parts.push(SUGAR_RU[sugar] ?? sugar);
        const syrups = options.syrups;
        if (Array.isArray(syrups)) {
          for (const s of syrups) {
            const key = String(s);
            parts.push(SYRUP_RU[key] ?? key);
          }
        }
        break;
      }
      case "flowers": {
        const pkg = pickAttrString(options, "packaging");
        if (pkg) parts.push(PACKAGING_RU[pkg] ?? pkg);
        const postcard = options.postcardText ?? options.postcard;
        if (typeof postcard === "string" && postcard.trim()) {
          parts.push(`Открытка: ${postcard.trim()}`);
        } else if (postcard === true) {
          parts.push("Открытка");
        }
        const delivery = pickAttrString(options, "deliveryDate");
        if (delivery) parts.push(`Доставка: ${delivery}`);
        const occasion = pickAttrString(options, "occasion");
        if (occasion) parts.push(`Повод: ${occasion}`);
        break;
      }
      case "fastfood": {
        const spicy = pickAttrString(options, "spicy");
        if (spicy) parts.push(SPICY_RU[spicy] ?? spicy);
        const addons = options.addons;
        if (Array.isArray(addons)) {
          for (const a of addons) {
            const key = String(a);
            parts.push(ADDON_RU[key] ?? key);
          }
        }
        if (options.combo === true) parts.push("Комбо");
        break;
      }
      default:
        break;
    }
  }

  if (parts.length === 0) {
    for (const [k, v] of Object.entries(options)) {
      if (v == null || v === "") continue;
      if (typeof v === "boolean") {
        if (v) parts.push(k);
        continue;
      }
      if (Array.isArray(v) && v.length > 0) {
        parts.push(`${k}: ${v.map(String).join(", ")}`);
        continue;
      }
      if (typeof v === "string" && v.trim()) parts.push(`${k}: ${v.trim()}`);
    }
  }

  return parts.join(" • ");
}

/** Customer-facing variant line from storage adapter (size/color columns). */
export function formatVariantSummary(input: {
  businessType: string | null | undefined;
  size?: string | null;
  color?: string | null;
  attributes?: Record<string, unknown> | null;
}): string {
  if (!isKnownBusinessType(input.businessType)) {
    const size = String(input.size ?? "").trim();
    return size || UNKNOWN_VERTICAL_PROFILE.cardPlaceholder;
  }

  const size = String(input.size ?? "").trim();
  const color = normalizeColorDisplay(String(input.color ?? "").trim());
  const attrs = input.attributes ?? {};

  switch (input.businessType) {
    case "clothing": {
      const parts = [color, size].filter(Boolean);
      return parts.length > 0 ? parts.join(" • ") : VERTICAL_PROFILES.clothing.cardPlaceholder;
    }
    case "coffee": {
      const vol = size || pickAttrString(attrs, "volume");
      const label = vol ? formatVolumeLabel(vol) : "";
      return label || VERTICAL_PROFILES.coffee.cardPlaceholder;
    }
    case "flowers": {
      const count = size || pickAttrString(attrs, "bouquetCount");
      if (count) return formatFlowerStemCount(count);
      const pkg = pickAttrString(attrs, "packaging");
      return pkg ? `Упаковка: ${PACKAGING_RU[pkg] ?? pkg}` : VERTICAL_PROFILES.flowers.cardPlaceholder;
    }
    case "fastfood": {
      const portion = size || pickAttrString(attrs, "size");
      const label = portion ? (FASTFOOD_PORTION_LABELS[portion] ?? portion) : "";
      return label || VERTICAL_PROFILES.fastfood.cardPlaceholder;
    }
    default:
      return size || UNKNOWN_VERTICAL_PROFILE.cardPlaceholder;
  }
}

/** Full cart / order line: variant + order options. */
export function formatOrderLineSummary(input: {
  businessType: string | null | undefined;
  size?: string | null;
  color?: string | null;
  options?: Record<string, unknown> | null;
  attributes?: Record<string, unknown> | null;
}): string {
  const variant = formatVariantSummary({
    businessType: input.businessType,
    size: input.size ?? null,
    color: input.color ?? null,
    attributes: input.attributes ?? null,
  });
  const opts = formatOrderOptionsSummary(input.businessType, input.options);
  if (variant && opts) return `${variant} • ${opts}`;
  return variant || opts || "";
}

/** Inventory / admin stock row label (ProductStock size/color). */
export function formatInventorySkuLabel(input: {
  businessType: string | null | undefined;
  size: string;
  color: string;
}): string {
  const variant = formatVariantSummary({
    businessType: input.businessType,
    size: input.size,
    color: input.color,
  });
  return variant || `${input.size}${input.color ? ` / ${input.color}` : ""}`.trim();
}

/** Keys handled via primary variant axis — omit from per-line order options UI. */
export function orderOptionKeysExcludedFromStorefront(
  businessType: string | null | undefined,
): Set<string> {
  if (!isKnownBusinessType(businessType)) return new Set();
  switch (businessType) {
    case "coffee":
      return new Set(["volume"]);
    case "flowers":
      return new Set(["bouquetCount"]);
    case "fastfood":
      return new Set(["size"]);
    default:
      return new Set(["size", "color"]);
  }
}

export function filterStorefrontOrderOptionsSchema<
  T extends Record<string, unknown>,
>(businessType: string | null | undefined, schema: T): T {
  const exclude = orderOptionKeysExcludedFromStorefront(businessType);
  const out = { ...schema };
  for (const key of exclude) {
    delete out[key];
  }
  return out;
}
