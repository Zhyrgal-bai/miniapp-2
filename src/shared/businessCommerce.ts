import type { BusinessType } from "@prisma/client";

export type VerticalInventoryMode =
  | "sku_matrix"
  | "single_axis"
  | "metadata_only";

export type VerticalCommerceProfile = {
  businessType: BusinessType;
  inventoryMode: VerticalInventoryMode;
  /** Maps to OrderItem.size / ProductStock.size */
  primaryAxisKey: "size";
  primaryAxisLabel: string;
  /** Maps to OrderItem.color; null = hide secondary picker */
  secondaryAxisKey: "color" | null;
  secondaryAxisLabel: string | null;
  /** Show size+color fashion UI (clothing only) */
  showFashionVariantMatrix: boolean;
  /** Show order-options fields from orderOptionsSchema on storefront */
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
    defaultPrimaryValues: ["S", "M", "L", "XL"],
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
    defaultPrimaryValues: ["250ml", "350ml", "450ml"],
    cardPlaceholder: "400 мл • горячий",
  },
  flowers: {
    businessType: "flowers",
    inventoryMode: "single_axis",
    primaryAxisKey: "size",
    primaryAxisLabel: "Количество",
    secondaryAxisKey: null,
    secondaryAxisLabel: null,
    showFashionVariantMatrix: false,
    showOrderOptionsOnStorefront: true,
    variantEditor: "bouquet_tiers",
    defaultPrimaryValues: ["21", "51", "101"],
    cardPlaceholder: "21 роз",
  },
  fastfood: {
    businessType: "fastfood",
    inventoryMode: "single_axis",
    primaryAxisKey: "size",
    primaryAxisLabel: "Размер",
    secondaryAxisKey: null,
    secondaryAxisLabel: null,
    showFashionVariantMatrix: false,
    showOrderOptionsOnStorefront: true,
    variantEditor: "tier_stock",
    defaultPrimaryValues: ["S", "M", "L"],
    cardPlaceholder: "M • без остроты",
  },
};

export function verticalProfileFor(
  businessType: string | null | undefined,
): VerticalCommerceProfile {
  const key = String(businessType ?? "clothing").trim() as BusinessType;
  return VERTICAL_PROFILES[key] ?? VERTICAL_PROFILES.clothing;
}

export function verticalUsesColorAxis(businessType: string | null | undefined): boolean {
  return verticalProfileFor(businessType).secondaryAxisKey === "color";
}

/** Customer-facing one-liner for catalog cards. */
export function formatVariantSummary(input: {
  businessType: string | null | undefined;
  size?: string | null;
  color?: string | null;
  attributes?: Record<string, unknown> | null;
}): string {
  const profile = verticalProfileFor(input.businessType);
  const size = String(input.size ?? "").trim();
  const color = String(input.color ?? "").trim();
  const attrs = input.attributes ?? {};

  switch (profile.businessType) {
    case "clothing": {
      const parts = [size, color].filter(Boolean);
      return parts.length > 0 ? parts.join(" • ") : profile.cardPlaceholder;
    }
    case "coffee": {
      const vol = size || pickAttrString(attrs, "volume");
      const temp = pickAttrString(attrs, "hotOrCold");
      const tempRu =
        temp === "hot" ? "горячий" : temp === "ice" ? "холодный" : temp;
      const parts = [vol, tempRu].filter(Boolean);
      return parts.length > 0 ? parts.join(" • ") : profile.cardPlaceholder;
    }
    case "flowers": {
      const count = size || pickAttrString(attrs, "bouquetCount");
      if (count) return `${count} роз`;
      const pkg = pickAttrString(attrs, "packaging");
      return pkg ? `Упаковка: ${pkg}` : profile.cardPlaceholder;
    }
    case "fastfood": {
      const sz = size || pickAttrString(attrs, "size");
      const spicy = pickAttrString(attrs, "spicy");
      const spicyRu =
        spicy === "hot"
          ? "острый"
          : spicy === "mild"
            ? "средняя острота"
            : spicy === "no"
              ? "не острый"
              : spicy;
      const parts = [sz, spicyRu].filter(Boolean);
      return parts.length > 0 ? parts.join(" • ") : profile.cardPlaceholder;
    }
    default:
      return profile.cardPlaceholder;
  }
}

function pickAttrString(
  attrs: Record<string, unknown>,
  key: string,
): string {
  const v = attrs[key];
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  if (Array.isArray(v) && typeof v[0] === "string") return v[0].trim();
  return "";
}

export const HOT_OR_COLD_RU: Record<string, string> = {
  hot: "Горячий",
  ice: "Холодный",
};

export const FLOWER_TIER_LABELS: Record<string, string> = {
  "21": "21 роза",
  "51": "51 роза",
  "101": "101 роза",
};

export function labelPrimaryOption(
  businessType: string | null | undefined,
  value: string,
): string {
  const profile = verticalProfileFor(businessType);
  if (profile.businessType === "flowers") {
    return FLOWER_TIER_LABELS[value] ?? `${value} шт`;
  }
  return value;
}
