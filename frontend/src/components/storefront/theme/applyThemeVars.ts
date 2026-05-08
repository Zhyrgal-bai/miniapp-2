import type { ResolvedStoreTheme } from "@repo-shared/storeTheme";
import { FONT_ALLOWLIST } from "../../../themeStudio/fonts";

function pick<T>(v: T | null | undefined, fallback: T): T {
  return v == null ? fallback : v;
}

/**
 * Converts resolved theme (with optional tokensV3) to CSS variables.
 * Applied on storefront container to avoid global leakage across tenants/pages.
 */
export function applyThemeVars(theme: ResolvedStoreTheme): Record<string, string> {
  const t3 = (theme as any).tokensV3 as any | undefined;
  if (t3 && typeof t3 === "object" && t3.palette && t3.typography) {
    // Minimal set for now (full mapping lives on backend too).
    const palette = t3.palette as Record<string, unknown>;
    const typo = t3.typography as Record<string, unknown>;
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

    return {
      "--sf-color-background": p("background", theme.bgColor),
      "--sf-color-card": p("card", theme.cardColor),
      "--sf-color-text": p("text", theme.textColor),
      "--sf-color-primary": p("primary", theme.primaryColor),
      "--sf-font-heading": fontStack(fonts.heading),
      "--sf-font-body": fontStack(fonts.body),
      "--sf-font-button": fontStack(fonts.button),
    };
  }

  // Fallback (V2)
  return {
    "--sf-color-background": pick(theme.bgColor, "#0f172a"),
    "--sf-color-card": pick(theme.cardColor, "#1e293b"),
    "--sf-color-text": pick(theme.textColor, "#ffffff"),
    "--sf-color-primary": pick(theme.primaryColor, "#6366f1"),
    "--sf-font-body": theme.tokens?.typography?.fontFamily ?? "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif",
    "--sf-font-heading": theme.tokens?.typography?.fontFamily ?? "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif",
    "--sf-font-button": theme.tokens?.typography?.fontFamily ?? "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif",
  };
}

