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

    return {
      "--sf-color-background": p("background", theme.bgColor),
      "--sf-color-surface": p("surface", theme.bgColor),
      "--sf-color-surfaceAlt": p("surfaceAlt", theme.cardColor),
      "--sf-color-border": p("border", "#334155"),
      "--sf-color-card": p("card", theme.cardColor),
      "--sf-color-text": p("text", theme.textColor),
      "--sf-color-muted": p("muted", "rgba(148,163,184,1)"),
      "--sf-color-primary": p("primary", theme.primaryColor),
      "--sf-color-secondary": p("secondary", "#22c55e"),
      "--sf-color-accent": p("accent", "#f97316"),
      "--sf-color-success": p("success", "#22c55e"),
      "--sf-color-warning": p("warning", "#f59e0b"),
      "--sf-color-danger": p("danger", "#ef4444"),
      "--sf-font-heading": fontStack(fonts.heading),
      "--sf-font-body": fontStack(fonts.body),
      "--sf-font-button": fontStack(fonts.button),
      "--sf-card-border-opacity": String(getNumber(cards?.borderOpacity, 0.08)),
      "--sf-button-padding-y": `${getNumber(buttons?.paddingY, 12)}px`,
      "--sf-button-padding-x": `${getNumber(buttons?.paddingX, 16)}px`,
    };
  }

  // Fallback (V2)
  return {
    "--sf-color-background": pick(theme.bgColor, "#0f172a"),
    "--sf-color-card": pick(theme.cardColor, "#1e293b"),
    "--sf-color-text": pick(theme.textColor, "#ffffff"),
    "--sf-color-primary": pick(theme.primaryColor, "#6366f1"),
    "--sf-color-border": "rgba(255,255,255,0.10)",
    "--sf-font-body": theme.tokens?.typography?.fontFamily ?? "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif",
    "--sf-font-heading": theme.tokens?.typography?.fontFamily ?? "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif",
    "--sf-font-button": theme.tokens?.typography?.fontFamily ?? "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif",
    "--sf-card-border-opacity": String(theme.tokens?.card?.borderOpacity ?? 0.08),
    "--sf-button-padding-y": `${theme.tokens?.button?.paddingY ?? 12}px`,
    "--sf-button-padding-x": `${theme.tokens?.button?.paddingX ?? 16}px`,
  };
}

