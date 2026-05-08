import { normalizeHexColor } from "../../shared/storeTheme.js";
import {
  FONT_IDS,
  type FontId,
  type ShadowPresetId,
  type ThemeDensity,
  type ThemeTokensV3,
} from "./types.js";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const x = typeof n === "number" && Number.isFinite(n) ? Math.trunc(n) : NaN;
  if (!Number.isInteger(x)) return fallback;
  return Math.min(max, Math.max(min, x));
}

function clampNum(n: unknown, min: number, max: number, fallback: number): number {
  const x = typeof n === "number" && Number.isFinite(n) ? n : NaN;
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, x));
}

function pickEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof v !== "string") return fallback;
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function pickFontId(v: unknown, fallback: FontId): FontId {
  return pickEnum(v, FONT_IDS, fallback);
}

function pickHex(v: unknown, fallback: string): string {
  if (typeof v !== "string") return fallback;
  return normalizeHexColor(v) ?? fallback;
}

function pickDensity(v: unknown, fallback: ThemeDensity): ThemeDensity {
  return pickEnum(v, ["compact", "normal", "comfortable"] as const, fallback);
}

function pickShadow(v: unknown, fallback: ShadowPresetId): ShadowPresetId {
  return pickEnum(v, ["none", "soft", "medium", "glow", "luxury"] as const, fallback);
}

export function normalizeThemeTokensV3(input: unknown, base: ThemeTokensV3): ThemeTokensV3 {
  if (!isPlainObject(input)) return base;

  const out: ThemeTokensV3 = {
    ...base,
    version: 3,
    density: pickDensity(input.density, base.density),
    palette: isPlainObject(input.palette)
      ? {
          primary: pickHex(input.palette.primary, base.palette.primary),
          secondary: pickHex(input.palette.secondary, base.palette.secondary),
          accent: pickHex(input.palette.accent, base.palette.accent),
          background: pickHex(input.palette.background, base.palette.background),
          surface: pickHex(input.palette.surface, base.palette.surface),
          surfaceAlt: pickHex(input.palette.surfaceAlt, base.palette.surfaceAlt),
          border: pickHex(input.palette.border, base.palette.border),
          card: pickHex(input.palette.card, base.palette.card),
          text: pickHex(input.palette.text, base.palette.text),
          muted: pickHex(input.palette.muted, base.palette.muted),
          success: pickHex(input.palette.success, base.palette.success),
          warning: pickHex(input.palette.warning, base.palette.warning),
          danger: pickHex(input.palette.danger, base.palette.danger),
        }
      : base.palette,
    typography: isPlainObject(input.typography)
      ? {
          fonts: isPlainObject((input.typography as any).fonts)
            ? {
                heading: pickFontId((input.typography as any).fonts.heading, base.typography.fonts.heading),
                body: pickFontId((input.typography as any).fonts.body, base.typography.fonts.body),
                button: pickFontId((input.typography as any).fonts.button, base.typography.fonts.button),
              }
            : base.typography.fonts,
          weights: isPlainObject((input.typography as any).weights)
            ? {
                heading: clampInt((input.typography as any).weights.heading, 400, 900, base.typography.weights.heading),
                body: clampInt((input.typography as any).weights.body, 300, 900, base.typography.weights.body),
                button: clampInt((input.typography as any).weights.button, 400, 900, base.typography.weights.button),
              }
            : base.typography.weights,
          sizes: isPlainObject((input.typography as any).sizes)
            ? {
                base: clampInt((input.typography as any).sizes.base, 12, 20, base.typography.sizes.base),
                h1: clampInt((input.typography as any).sizes.h1, 18, 44, base.typography.sizes.h1),
                h2: clampInt((input.typography as any).sizes.h2, 16, 36, base.typography.sizes.h2),
                h3: clampInt((input.typography as any).sizes.h3, 14, 30, base.typography.sizes.h3),
                body: clampInt((input.typography as any).sizes.body, 12, 22, base.typography.sizes.body),
                small: clampInt((input.typography as any).sizes.small, 10, 18, base.typography.sizes.small),
                button: clampInt((input.typography as any).sizes.button, 11, 22, base.typography.sizes.button),
              }
            : base.typography.sizes,
          lineHeights: isPlainObject((input.typography as any).lineHeights)
            ? {
                heading: clampNum((input.typography as any).lineHeights.heading, 1.0, 1.4, base.typography.lineHeights.heading),
                body: clampNum((input.typography as any).lineHeights.body, 1.2, 1.8, base.typography.lineHeights.body),
                tight: clampNum((input.typography as any).lineHeights.tight, 1.0, 1.2, base.typography.lineHeights.tight),
              }
            : base.typography.lineHeights,
          letterSpacing: isPlainObject((input.typography as any).letterSpacing)
            ? {
                heading: clampNum((input.typography as any).letterSpacing.heading, -0.02, 0.08, base.typography.letterSpacing.heading),
                body: clampNum((input.typography as any).letterSpacing.body, -0.02, 0.08, base.typography.letterSpacing.body),
                button: clampNum((input.typography as any).letterSpacing.button, -0.02, 0.16, base.typography.letterSpacing.button),
              }
            : base.typography.letterSpacing,
        }
      : base.typography,
    spacing: isPlainObject(input.spacing)
      ? {
          xs: clampInt(input.spacing.xs, 2, 16, base.spacing.xs),
          sm: clampInt(input.spacing.sm, 4, 24, base.spacing.sm),
          md: clampInt(input.spacing.md, 8, 40, base.spacing.md),
          lg: clampInt(input.spacing.lg, 12, 72, base.spacing.lg),
          xl: clampInt(input.spacing.xl, 16, 96, base.spacing.xl),
          xxl: clampInt(input.spacing.xxl, 20, 120, base.spacing.xxl),
        }
      : base.spacing,
    radius: isPlainObject(input.radius)
      ? {
          xs: clampInt(input.radius.xs, 0, 20, base.radius.xs),
          sm: clampInt(input.radius.sm, 0, 28, base.radius.sm),
          md: clampInt(input.radius.md, 0, 32, base.radius.md),
          lg: clampInt(input.radius.lg, 0, 40, base.radius.lg),
          xl: clampInt(input.radius.xl, 0, 48, base.radius.xl),
          full: 999,
        }
      : base.radius,
    components: isPlainObject(input.components)
      ? {
          buttons: isPlainObject((input.components as any).buttons)
            ? {
                style: pickEnum((input.components as any).buttons.style, ["filled", "outline", "soft", "glass", "gradient"] as const, base.components.buttons.style),
                radius: pickEnum((input.components as any).buttons.radius, ["xs", "sm", "md", "lg", "xl", "full"] as const, base.components.buttons.radius),
                paddingY: clampInt((input.components as any).buttons.paddingY, 6, 24, base.components.buttons.paddingY),
                paddingX: clampInt((input.components as any).buttons.paddingX, 8, 32, base.components.buttons.paddingX),
              }
            : base.components.buttons,
          cards: isPlainObject((input.components as any).cards)
            ? {
                style: pickEnum((input.components as any).cards.style, ["flat", "elevated", "bordered", "glass", "luxury"] as const, base.components.cards.style),
                radius: pickEnum((input.components as any).cards.radius, ["xs", "sm", "md", "lg", "xl"] as const, base.components.cards.radius),
                shadow: pickShadow((input.components as any).cards.shadow, base.components.cards.shadow),
                borderOpacity: clampNum((input.components as any).cards.borderOpacity, 0, 0.3, base.components.cards.borderOpacity),
              }
            : base.components.cards,
        }
      : base.components,
    motion: isPlainObject(input.motion)
      ? { preset: pickEnum((input.motion as any).preset, ["disabled", "subtle", "smooth", "energetic"] as const, base.motion.preset) }
      : base.motion,
  };

  return out;
}

