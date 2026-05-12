import type { ResolvedStoreTheme } from "@repo-shared/storeTheme";
import { FONT_ALLOWLIST } from "../../../themeStudio/fonts";

function pick<T>(v: T | null | undefined, fallback: T): T {
  return v == null ? fallback : v;
}

function getObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function getNumber(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function getString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

/** Parses #RGB / #RRGGBB; returns null if not a hex color. */
function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim();
  const m6 = /^#([0-9a-fA-F]{6})$/.exec(h);
  const m3 = /^#([0-9a-fA-F]{3})$/.exec(h);
  if (m6) {
    const n = m6[1]!;
    return {
      r: parseInt(n.slice(0, 2), 16),
      g: parseInt(n.slice(2, 4), 16),
      b: parseInt(n.slice(4, 6), 16),
    };
  }
  if (m3) {
    const n = m3[1]!;
    return {
      r: parseInt(n.slice(0, 1).repeat(2), 16),
      g: parseInt(n.slice(1, 2).repeat(2), 16),
      b: parseInt(n.slice(2, 3).repeat(2), 16),
    };
  }
  return null;
}

function hexToRgba(hex: string, alpha01: number): string {
  const a = Math.max(0, Math.min(1, alpha01));
  const rgb = parseHexRgb(hex);
  const r = rgb?.r ?? 255;
  const g = rgb?.g ?? 255;
  const b = rgb?.b ?? 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Light text on dark primaries, near-black on light primaries (simple luminance). */
function onPrimaryForHex(hex: string): string {
  const rgb = parseHexRgb(hex);
  if (!rgb) return "#ffffff";
  const { r, g, b } = rgb;
  const y = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return y > 0.55 ? "#0f172a" : "#ffffff";
}

function shadowFor(id: string, primaryHex: string): string {
  switch (id) {
    case "none":
      return "none";
    case "soft":
      return "0 2px 10px rgba(0,0,0,0.16)";
    case "glow":
      return `0 10px 30px ${hexToRgba(primaryHex, 0.28)}`;
    case "luxury":
      return "0 18px 60px rgba(0,0,0,0.35)";
    case "medium":
    default:
      return "0 10px 26px rgba(0,0,0,0.22)";
  }
}

/**
 * Converts resolved theme (with optional tokensV3) to CSS variables.
 * Applied on storefront container to avoid global leakage across tenants/pages.
 */
export function applyThemeVars(theme: ResolvedStoreTheme): Record<string, string> {
  const t3 = (theme as unknown as { tokensV3?: unknown }).tokensV3;
  const t3obj = getObj(t3);
  if (t3obj && getObj(t3obj.palette) && getObj(t3obj.typography)) {
    const palette = (t3obj.palette ?? {}) as Record<string, unknown>;
    const typo = (t3obj.typography ?? {}) as Record<string, unknown>;
    const fonts = (typo.fonts as Record<string, unknown>) ?? {};
    const fontStack = (id: unknown): string => {
      const v = typeof id === "string" ? id : "system";
      const found = FONT_ALLOWLIST.find((f) => f.id === v);
      return found?.cssFamily ?? FONT_ALLOWLIST[0].cssFamily;
    };

    const p = (k: string, fb: string) => {
      const v = palette[k];
      return typeof v === "string" && v.trim() ? v.trim() : fb;
    };

    const components = getObj(t3obj.components);
    const cards = getObj(components?.cards);
    const buttons = getObj(components?.buttons);
    const spacing = getObj(t3obj.spacing);
    const radius = getObj(t3obj.radius);

    const primaryHex = getString(palette.primary, theme.primaryColor);
    const onPrimary = onPrimaryForHex(primaryHex);
    const borderHex = getString(palette.border, "#334155");
    const cardBorderOpacity = getNumber(cards?.borderOpacity, 0.08);
    const cardBorderColor = hexToRgba(borderHex, cardBorderOpacity);

    const cardShadowId = getString(cards?.shadow, "medium");
    const cardShadow = shadowFor(cardShadowId, primaryHex);
    const cardRadiusId = getString(cards?.radius, "lg");
    const radiusMap: Record<string, string> = {
      xs: `${getNumber(radius?.xs, 8)}px`,
      sm: `${getNumber(radius?.sm, 10)}px`,
      md: `${getNumber(radius?.md, 14)}px`,
      lg: `${getNumber(radius?.lg, 18)}px`,
      xl: `${getNumber(radius?.xl, 24)}px`,
      full: `${getNumber(radius?.full, 999)}px`,
    };

    return {
      "--sf-color-background": p("background", theme.bgColor),
      "--sf-color-surface": p("surface", theme.bgColor),
      "--sf-color-surfaceAlt": p("surfaceAlt", theme.cardColor),
      "--sf-color-border": p("border", "#334155"),
      "--sf-color-card": p("card", theme.cardColor),
      "--sf-color-text": p("text", theme.textColor),
      "--sf-color-muted": p("muted", "rgba(148,163,184,1)"),
      "--sf-color-primary": primaryHex,
      "--sf-on-primary": onPrimary,
      "--sf-color-secondary": p("secondary", "#22c55e"),
      "--sf-color-accent": p("accent", "#f97316"),
      "--sf-color-success": p("success", "#22c55e"),
      "--sf-color-warning": p("warning", "#f59e0b"),
      "--sf-color-danger": p("danger", "#ef4444"),
      "--sf-font-heading": fontStack(fonts.heading),
      "--sf-font-body": fontStack(fonts.body),
      "--sf-font-button": fontStack(fonts.button),
      "--sf-space-xs": `${getNumber(spacing?.xs, 6)}px`,
      "--sf-space-sm": `${getNumber(spacing?.sm, 10)}px`,
      "--sf-space-md": `${getNumber(spacing?.md, 16)}px`,
      "--sf-space-lg": `${getNumber(spacing?.lg, 24)}px`,
      "--sf-space-xl": `${getNumber(spacing?.xl, 32)}px`,
      "--sf-space-xxl": `${getNumber(spacing?.xxl, 40)}px`,
      "--sf-radius-xs": radiusMap.xs,
      "--sf-radius-sm": radiusMap.sm,
      "--sf-radius-md": radiusMap.md,
      "--sf-radius-lg": radiusMap.lg,
      "--sf-radius-xl": radiusMap.xl,
      "--sf-radius-full": radiusMap.full,
      "--sf-shadow-card": cardShadow,
      "--sf-card-radius": radiusMap[cardRadiusId] ?? radiusMap.lg,
      "--sf-card-border-opacity": String(cardBorderOpacity),
      "--sf-card-border-color": cardBorderColor,
      "--sf-card-shadow": cardShadow,
      "--sf-card-hover-shadow": cardShadowId === "none" ? "none" : shadowFor("luxury", primaryHex),
      "--sf-button-padding-y": `${getNumber(buttons?.paddingY, 12)}px`,
      "--sf-button-padding-x": `${getNumber(buttons?.paddingX, 16)}px`,
    };
  }

  // Fallback (V2)
  const legacyPrimary = pick(theme.primaryColor, "#6366f1");
  return {
    "--sf-color-background": pick(theme.bgColor, "#0f172a"),
    "--sf-color-card": pick(theme.cardColor, "#1e293b"),
    "--sf-color-text": pick(theme.textColor, "#ffffff"),
    "--sf-color-muted": "rgba(148,163,184,0.92)",
    "--sf-color-primary": legacyPrimary,
    "--sf-on-primary": onPrimaryForHex(legacyPrimary),
    "--sf-color-border": "rgba(255,255,255,0.10)",
    "--sf-font-body": theme.tokens?.typography?.fontFamily ?? "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif",
    "--sf-font-heading": theme.tokens?.typography?.fontFamily ?? "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif",
    "--sf-font-button": theme.tokens?.typography?.fontFamily ?? "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif",
    "--sf-card-border-opacity": String(theme.tokens?.card?.borderOpacity ?? 0.08),
    "--sf-card-border-color": `rgba(255,255,255,${theme.tokens?.card?.borderOpacity ?? 0.08})`,
    "--sf-button-padding-y": `${theme.tokens?.button?.paddingY ?? 12}px`,
    "--sf-button-padding-x": `${theme.tokens?.button?.paddingX ?? 16}px`,
  };
}

