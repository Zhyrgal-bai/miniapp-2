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
  | "fashion"
  | "overlay_cta"
  | "bottom_cta"
  | "floating_cta";

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
};

export function isCatalogCardPresetId(v: unknown): v is CatalogCardPresetId {
  return typeof v === "string" && v in PRESETS;
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
