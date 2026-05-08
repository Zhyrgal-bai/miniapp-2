import type { ThemeTokensV2 } from "./tokens.js";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const x = typeof n === "number" && Number.isFinite(n) ? Math.trunc(n) : NaN;
  if (!Number.isInteger(x)) return fallback;
  return Math.min(max, Math.max(min, x));
}

function pickString(v: unknown, fallback: string, maxLen = 200): string {
  if (typeof v !== "string") return fallback;
  const t = v.trim();
  return t === "" ? fallback : t.slice(0, maxLen);
}

export function normalizeThemeTokensV2(
  input: unknown,
  base: ThemeTokensV2,
): ThemeTokensV2 {
  if (!isPlainObject(input)) return base;

  const b = base;
  const out: ThemeTokensV2 = {
    typography: {
      fontFamily: pickString(input.typography && (input.typography as any).fontFamily, b.typography.fontFamily, 260),
      baseFontSize: clampInt(input.typography && (input.typography as any).baseFontSize, 12, 22, b.typography.baseFontSize),
      headingWeight: clampInt(input.typography && (input.typography as any).headingWeight, 400, 900, b.typography.headingWeight),
      bodyWeight: clampInt(input.typography && (input.typography as any).bodyWeight, 300, 900, b.typography.bodyWeight),
    },
    spacing: {
      xs: clampInt(input.spacing && (input.spacing as any).xs, 2, 16, b.spacing.xs),
      sm: clampInt(input.spacing && (input.spacing as any).sm, 4, 24, b.spacing.sm),
      md: clampInt(input.spacing && (input.spacing as any).md, 8, 40, b.spacing.md),
      lg: clampInt(input.spacing && (input.spacing as any).lg, 12, 64, b.spacing.lg),
      xl: clampInt(input.spacing && (input.spacing as any).xl, 16, 96, b.spacing.xl),
    },
    radius: {
      sm: clampInt(input.radius && (input.radius as any).sm, 0, 28, b.radius.sm),
      md: clampInt(input.radius && (input.radius as any).md, 0, 32, b.radius.md),
      lg: clampInt(input.radius && (input.radius as any).lg, 0, 40, b.radius.lg),
      pill: 999,
    },
    shadows: {
      sm: pickString(input.shadows && (input.shadows as any).sm, b.shadows.sm, 120),
      md: pickString(input.shadows && (input.shadows as any).md, b.shadows.md, 120),
      lg: pickString(input.shadows && (input.shadows as any).lg, b.shadows.lg, 120),
    },
    gradients: {
      header: pickString(input.gradients && (input.gradients as any).header, b.gradients.header, 200),
      hero: pickString(input.gradients && (input.gradients as any).hero, b.gradients.hero, 200),
    },
    animations: {
      fastMs: clampInt(input.animations && (input.animations as any).fastMs, 0, 800, b.animations.fastMs),
      normalMs: clampInt(input.animations && (input.animations as any).normalMs, 0, 2000, b.animations.normalMs),
    },
    button: {
      radius: clampInt(input.button && (input.button as any).radius, 0, 28, b.button.radius),
      paddingY: clampInt(input.button && (input.button as any).paddingY, 6, 24, b.button.paddingY),
      paddingX: clampInt(input.button && (input.button as any).paddingX, 8, 32, b.button.paddingX),
    },
    card: {
      radius: clampInt(input.card && (input.card as any).radius, 0, 40, b.card.radius),
      padding: clampInt(input.card && (input.card as any).padding, 8, 40, b.card.padding),
      borderOpacity: (() => {
        const v = input.card && (input.card as any).borderOpacity;
        const n = typeof v === "number" && Number.isFinite(v) ? v : NaN;
        if (!Number.isFinite(n)) return b.card.borderOpacity;
        return Math.min(0.3, Math.max(0, n));
      })(),
    },
  };

  return out;
}

