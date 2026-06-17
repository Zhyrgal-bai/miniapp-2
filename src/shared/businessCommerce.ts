import type { BusinessTypeId } from "./businessTypes.js";
import {
  resolveUniversalVerticalProfile,
  UNIVERSAL_VERTICAL_BASE,
} from "./universalCommerce.js";
import { getBusinessTemplateDescriptor } from "../templates/registry/businessTemplateRegistry.js";

export type VerticalInventoryMode =
  | "sku_matrix"
  | "single_axis"
  | "metadata_only";

/** Internal one-size SKU for accessories (hidden on storefront). */
export const ACCESSORY_ONE_SIZE = "ONE";

export function isAccessoryOneSize(size: string | null | undefined): boolean {
  return String(size ?? "").trim().toUpperCase() === ACCESSORY_ONE_SIZE;
}

export type VerticalCommerceProfile = {
  businessType: BusinessTypeId;
  inventoryMode: VerticalInventoryMode;
  /** Business axis id; `memory` maps to OrderItem.size / ProductStock.size (storage adapter). */
  primaryAxisKey: "size" | "memory";
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

function profileFromDescriptor(
  businessType: Exclude<BusinessTypeId, "universal">,
): VerticalCommerceProfile {
  const d = getBusinessTemplateDescriptor(businessType);
  return {
    businessType,
    inventoryMode: d.variantPolicy.mode,
    primaryAxisKey: d.variantPolicy.primaryAxisKey,
    primaryAxisLabel: d.variantPolicy.primaryAxisLabel,
    secondaryAxisKey: d.variantPolicy.secondaryAxisKey,
    secondaryAxisLabel: d.variantPolicy.secondaryAxisLabel,
    showFashionVariantMatrix: d.variantPolicy.showFashionVariantMatrix,
    showOrderOptionsOnStorefront: d.variantPolicy.showOrderOptionsOnStorefront,
    variantEditor: d.variantPolicy.variantEditor,
    defaultPrimaryValues: d.variantPolicy.defaultPrimaryValues,
    cardPlaceholder: d.catalogBehavior.cardPlaceholder,
  };
}

export const VERTICAL_PROFILES: Record<BusinessTypeId, VerticalCommerceProfile> = {
  universal: UNIVERSAL_VERTICAL_BASE,
  clothing: profileFromDescriptor("clothing"),
  flowers: profileFromDescriptor("flowers"),
  coffee: profileFromDescriptor("coffee"),
  fastfood: profileFromDescriptor("fastfood"),
  electronics: profileFromDescriptor("electronics"),
  autoparts: profileFromDescriptor("autoparts"),
  cosmetics: profileFromDescriptor("cosmetics"),
  furniture: profileFromDescriptor("furniture"),
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
): businessType is BusinessTypeId {
  const key = String(businessType ?? "").trim();
  return key !== "" && KNOWN_BUSINESS_TYPES.has(key);
}

export function verticalProfileFor(
  businessType: string | null | undefined,
  merchantConfig?: Record<string, unknown> | null,
): VerticalCommerceProfile {
  const key = String(businessType ?? "").trim();
  if (key === "universal") {
    return resolveUniversalVerticalProfile(merchantConfig);
  }
  if (key !== "" && VERTICAL_PROFILES[key as BusinessTypeId]) {
    return VERTICAL_PROFILES[key as BusinessTypeId];
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
  merchantConfig?: Record<string, unknown> | null,
): boolean {
  if (!isKnownBusinessType(businessType)) return false;
  if (businessType === "universal") {
    return resolveUniversalVerticalProfile(merchantConfig).secondaryAxisKey === "color";
  }
  return VERTICAL_PROFILES[businessType].secondaryAxisKey === "color";
}

export const HOT_OR_COLD_RU: Record<string, string> = {
  hot: "Горячий",
  ice: "Холодный",
};

export const SUGAR_RU: Record<string, string> = {
  "0": "0%",
  "50": "50%",
  "100": "100%",
  no: "Без сахара",
  less: "Меньше сахара",
  normal: "Обычный",
};

export const MILK_RU: Record<string, string> = {
  regular: "Обычное",
  coconut: "Кокосовое",
  soy: "Соевое",
};

export const SKIN_TYPE_RU: Record<string, string> = {
  all: "Для всех типов",
  dry: "Сухая кожа",
  normal: "Нормальная",
  oily: "Жирная",
  combo: "Комбинированная",
  sensitive: "Чувствительная",
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
  if (isAccessoryOneSize(v)) return "";
  if (!isKnownBusinessType(businessType)) return v;

  switch (businessType) {
    case "flowers":
      return FLOWER_TIER_LABELS[v] ?? formatFlowerStemCount(v);
    case "coffee":
      return formatVolumeLabel(v);
    case "fastfood":
      return FASTFOOD_PORTION_LABELS[v] ?? v;
    case "electronics":
    case "autoparts":
    case "cosmetics":
    case "furniture":
      return v;
    case "universal":
      return v;
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
        const milk = pickAttrString(options, "milk");
        if (milk) parts.push(MILK_RU[milk] ?? milk);
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
        const orderNote = pickAttrString(options, "orderNote");
        if (orderNote) parts.push(`Заметка: ${orderNote}`);
        break;
      }
      case "electronics": {
        const serial = pickAttrString(options, "serialNumber");
        if (serial) parts.push(`Серийный: ${serial}`);
        break;
      }
      case "autoparts": {
        const vin = pickAttrString(options, "vin");
        if (vin) parts.push(`VIN: ${vin}`);
        break;
      }
      case "cosmetics": {
        const skinType = pickAttrString(options, "skinType");
        if (skinType) parts.push(`Тип кожи: ${SKIN_TYPE_RU[skinType] ?? skinType}`);
        break;
      }
      case "furniture": {
        const assembly = options.assemblyRequired;
        if (assembly === true) parts.push("Нужна сборка");
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
    case "electronics": {
      const model = pickAttrString(attrs, "model");
      const label = size || model;
      return label || VERTICAL_PROFILES.electronics.cardPlaceholder;
    }
    case "autoparts": {
      const sku = pickAttrString(attrs, "sku");
      const comp = pickAttrString(attrs, "compatibility");
      const label = size || sku || comp;
      return label || VERTICAL_PROFILES.autoparts.cardPlaceholder;
    }
    case "cosmetics": {
      const vol = pickAttrString(attrs, "volume");
      const label = size || vol;
      return label || VERTICAL_PROFILES.cosmetics.cardPlaceholder;
    }
    case "furniture": {
      const dims = pickAttrString(attrs, "dimensions");
      const label = size || dims;
      return label || VERTICAL_PROFILES.furniture.cardPlaceholder;
    }
    case "universal": {
      const label = size ? labelPrimaryOption("universal", size) : "";
      return label || VERTICAL_PROFILES.universal.cardPlaceholder;
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
    case "electronics":
      return new Set(["serialNumber"]);
    case "autoparts":
      return new Set(["vin", "compatibility"]);
    case "cosmetics":
      return new Set(["skinType"]);
    case "furniture":
      return new Set(["assemblyRequired"]);
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
