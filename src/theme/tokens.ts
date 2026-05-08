export type ThemeTypography = {
  fontFamily: string;
  baseFontSize: number; // px
  headingWeight: number;
  bodyWeight: number;
};

export type ThemeSpacing = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
};

export type ThemeRadius = {
  sm: number;
  md: number;
  lg: number;
  pill: number;
};

export type ThemeShadows = {
  sm: string;
  md: string;
  lg: string;
};

export type ThemeGradients = {
  header: string;
  hero: string;
};

export type ThemeAnimations = {
  fastMs: number;
  normalMs: number;
};

export type ThemeButtonStyle = {
  radius: number;
  paddingY: number;
  paddingX: number;
};

export type ThemeCardStyle = {
  radius: number;
  padding: number;
  borderOpacity: number; // 0..1
};

export type ThemeTokensV2 = {
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  radius: ThemeRadius;
  shadows: ThemeShadows;
  gradients: ThemeGradients;
  animations: ThemeAnimations;
  button: ThemeButtonStyle;
  card: ThemeCardStyle;
};

export function defaultThemeTokens(): ThemeTokensV2 {
  return {
    typography: {
      fontFamily:
        "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif",
      baseFontSize: 16,
      headingWeight: 800,
      bodyWeight: 500,
    },
    spacing: { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 },
    radius: { sm: 10, md: 14, lg: 18, pill: 999 },
    shadows: {
      sm: "0 2px 8px rgba(0,0,0,0.18)",
      md: "0 8px 24px rgba(0,0,0,0.22)",
      lg: "0 16px 48px rgba(0,0,0,0.28)",
    },
    gradients: {
      header: "linear-gradient(90deg, rgba(15,23,42,1) 0%, rgba(30,41,59,1) 100%)",
      hero: "linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(239,68,68,0.10) 100%)",
    },
    animations: { fastMs: 150, normalMs: 300 },
    button: { radius: 12, paddingY: 12, paddingX: 16 },
    card: { radius: 16, padding: 16, borderOpacity: 0.08 },
  };
}
