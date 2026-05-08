import type { ThemeTokensV3 } from "../designTokens/v3/types.js";

const FONT_STACKS: Record<string, string> = {
  system:
    "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif",
  inter:
    "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif",
  poppins:
    "Poppins, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif",
  manrope:
    "Manrope, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif",
  montserrat:
    "Montserrat, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif",
  bebasNeue:
    "\"Bebas Neue\", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif",
  playfairDisplay:
    "\"Playfair Display\", ui-serif, Georgia, Times New Roman, serif",
};

const SHADOWS: Record<string, string> = {
  none: "none",
  soft: "0 2px 10px rgba(0,0,0,0.16)",
  medium: "0 10px 26px rgba(0,0,0,0.22)",
  glow: "0 10px 30px rgba(99,102,241,0.30)",
  luxury: "0 18px 60px rgba(0,0,0,0.35)",
};

export function tokensV3ToCssVars(tokens: ThemeTokensV3): Record<string, string> {
  const t = tokens;
  const vars: Record<string, string> = {
    "--sf-density": t.density,

    "--sf-color-primary": t.palette.primary,
    "--sf-color-secondary": t.palette.secondary,
    "--sf-color-accent": t.palette.accent,
    "--sf-color-background": t.palette.background,
    "--sf-color-surface": t.palette.surface,
    "--sf-color-surfaceAlt": t.palette.surfaceAlt,
    "--sf-color-border": t.palette.border,
    "--sf-color-card": t.palette.card,
    "--sf-color-text": t.palette.text,
    "--sf-color-muted": t.palette.muted,
    "--sf-color-success": t.palette.success,
    "--sf-color-warning": t.palette.warning,
    "--sf-color-danger": t.palette.danger,

    "--sf-font-heading": FONT_STACKS[t.typography.fonts.heading] ?? FONT_STACKS.system!,
    "--sf-font-body": FONT_STACKS[t.typography.fonts.body] ?? FONT_STACKS.system!,
    "--sf-font-button": FONT_STACKS[t.typography.fonts.button] ?? FONT_STACKS.system!,

    "--sf-font-weight-heading": String(t.typography.weights.heading),
    "--sf-font-weight-body": String(t.typography.weights.body),
    "--sf-font-weight-button": String(t.typography.weights.button),

    "--sf-font-size-base": `${t.typography.sizes.base}px`,
    "--sf-font-size-h1": `${t.typography.sizes.h1}px`,
    "--sf-font-size-h2": `${t.typography.sizes.h2}px`,
    "--sf-font-size-h3": `${t.typography.sizes.h3}px`,
    "--sf-font-size-body": `${t.typography.sizes.body}px`,
    "--sf-font-size-small": `${t.typography.sizes.small}px`,
    "--sf-font-size-button": `${t.typography.sizes.button}px`,

    "--sf-line-height-heading": String(t.typography.lineHeights.heading),
    "--sf-line-height-body": String(t.typography.lineHeights.body),
    "--sf-line-height-tight": String(t.typography.lineHeights.tight),

    "--sf-letter-spacing-heading": `${t.typography.letterSpacing.heading}em`,
    "--sf-letter-spacing-body": `${t.typography.letterSpacing.body}em`,
    "--sf-letter-spacing-button": `${t.typography.letterSpacing.button}em`,

    "--sf-space-xs": `${t.spacing.xs}px`,
    "--sf-space-sm": `${t.spacing.sm}px`,
    "--sf-space-md": `${t.spacing.md}px`,
    "--sf-space-lg": `${t.spacing.lg}px`,
    "--sf-space-xl": `${t.spacing.xl}px`,
    "--sf-space-xxl": `${t.spacing.xxl}px`,

    "--sf-radius-xs": `${t.radius.xs}px`,
    "--sf-radius-sm": `${t.radius.sm}px`,
    "--sf-radius-md": `${t.radius.md}px`,
    "--sf-radius-lg": `${t.radius.lg}px`,
    "--sf-radius-xl": `${t.radius.xl}px`,
    "--sf-radius-full": `${t.radius.full}px`,

    "--sf-shadow-card": SHADOWS[t.components.cards.shadow] ?? SHADOWS.medium!,
    "--sf-card-border-opacity": String(t.components.cards.borderOpacity),

    "--sf-button-padding-y": `${t.components.buttons.paddingY}px`,
    "--sf-button-padding-x": `${t.components.buttons.paddingX}px`,
  };

  return vars;
}

