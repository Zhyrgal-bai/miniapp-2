/**
 * Maps optional `catalogCardPreset` on storefront card config to concrete ProductCard fields.
 * Merchants can set `catalogCardPreset` + overrides in `storefrontCardConfig` JSON.
 */
export type CatalogCardPresetId =
  | "compact_grid"
  | "luxury_grid"
  | "minimal_list"
  | "modern_cards"
  | "marketplace"
  | "premium_showcase"
  | "snackable_mobile"
  | "fashion"
  | "overlay_cta"
  | "bottom_cta"
  | "floating_cta"
  | "rail_row";

const PRESETS: Record<CatalogCardPresetId, Record<string, unknown>> = {
  compact_grid: {
    variant: "compact",
    density: "compact",
    imageRatio: "square",
    compact: true,
    shadow: false,
    hoverEffect: "none",
    ctaStyle: "full",
  },
  luxury_grid: {
    variant: "luxury",
    density: "airy",
    imageRatio: "portrait",
    priceStyle: "luxury",
    badgeStyle: "luxury",
    ctaStyle: "pill",
    shadow: true,
  },
  minimal_list: {
    variant: "minimal",
    density: "compact",
    catalogLayout: "list",
    imageRatio: "square",
    shadow: false,
    hoverEffect: "none",
    ctaStyle: "outline",
  },
  modern_cards: {
    variant: "modern",
    density: "normal",
    imageRatio: "portrait",
    rounded: true,
    shadow: true,
    ctaStyle: "pill",
  },
  marketplace: {
    variant: "marketplace",
    density: "compact",
    imageRatio: "square",
    priceStyle: "compact",
    ctaStyle: "full",
  },
  premium_showcase: {
    variant: "luxury",
    density: "airy",
    imageRatio: "portrait",
    shadow: true,
    hoverEffect: "lift",
    badgeStyle: "luxury",
    priceStyle: "bold",
    ctaStyle: "pill",
  },
  snackable_mobile: {
    variant: "modern",
    density: "compact",
    imageRatio: "square",
    rounded: true,
    hoverEffect: "none",
    ctaStyle: "full",
    priceStyle: "compact",
  },
  fashion: {
    variant: "fashion",
    density: "normal",
    imageRatio: "portrait",
    badgeStyle: "glow",
    ctaStyle: "pill",
  },
  overlay_cta: {
    variant: "luxury",
    imageRatio: "portrait",
    imageShadow: true,
    textAlign: "center",
    ctaStyle: "glow",
  },
  bottom_cta: {
    variant: "marketplace",
    ctaStyle: "full",
    textAlign: "left",
  },
  floating_cta: {
    variant: "fashion",
    density: "compact",
    ctaStyle: "pill",
    textAlign: "center",
  },
  rail_row: {
    variant: "marketplace",
    density: "compact",
    imageRatio: "square",
    catalogLayout: "rail",
    priceStyle: "bold",
    ctaStyle: "full",
    shadow: false,
  },
};

export function isCatalogCardPresetId(v: unknown): v is CatalogCardPresetId {
  return typeof v === "string" && v in PRESETS;
}

export function defaultCatalogCardPresetForBusinessType(
  businessTypeRaw: string | null | undefined,
): CatalogCardPresetId {
  const businessType = String(businessTypeRaw ?? "").trim().toLowerCase();
  if (businessType.includes("fashion") || businessType.includes("clothing")) return "premium_showcase";
  if (businessType.includes("coffee") || businessType.includes("fastfood")) return "snackable_mobile";
  if (businessType.includes("flower")) return "modern_cards";
  return "marketplace";
}

/** Deep-merge: base storefront card config wins over preset for each key present on base. */
export function mergeStorefrontCardConfigWithPreset(
  raw: Record<string, unknown> | undefined | null,
): Record<string, unknown> {
  const base = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
  const pid = base.catalogCardPreset;
  if (!isCatalogCardPresetId(pid)) return base;
  const preset = { ...PRESETS[pid] };
  delete base.catalogCardPreset;
  return { ...preset, ...base };
}

/** Viewport tier for `responsiveCardPreset` layers (admin builder). */
export type StorefrontCardViewportTier = "default" | "md" | "lg";

function applyCardConfigLayer(
  merged: Record<string, unknown>,
  layer: unknown,
): Record<string, unknown> {
  if (layer == null || typeof layer !== "object" || Array.isArray(layer)) return merged;
  const next = mergeStorefrontCardConfigWithPreset(layer as Record<string, unknown>);
  return { ...merged, ...next };
}

/**
 * Applies `catalogCardPreset` then optional `responsiveCardPreset` layers:
 * `{ default?: object, md?: object, lg?: object }` — md from 640px, lg from 1024px.
 */
export function mergeStorefrontCardConfigWithResponsive(
  raw: Record<string, unknown> | undefined | null,
  tier: StorefrontCardViewportTier,
): Record<string, unknown> {
  const base = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
  const rcp = base.responsiveCardPreset;
  delete base.responsiveCardPreset;
  let merged = mergeStorefrontCardConfigWithPreset(base);
  if (rcp == null || typeof rcp !== "object" || Array.isArray(rcp)) return merged;
  const o = rcp as Record<string, unknown>;
  merged = applyCardConfigLayer(merged, o.default ?? o.sm);
  if (tier === "md" || tier === "lg") merged = applyCardConfigLayer(merged, o.md);
  if (tier === "lg") merged = applyCardConfigLayer(merged, o.lg);
  return merged;
}
