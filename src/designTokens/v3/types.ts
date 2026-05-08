export type ThemeDensity = "compact" | "normal" | "comfortable";

export const FONT_IDS = [
  "system",
  "inter",
  "poppins",
  "manrope",
  "montserrat",
  "bebasNeue",
  "playfairDisplay",
] as const;

export type FontId = (typeof FONT_IDS)[number];

export type ThemePaletteV3 = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  card: string;
  text: string;
  muted: string;
  success: string;
  warning: string;
  danger: string;
};

export type ThemeTypographyV3 = {
  fonts: {
    heading: FontId;
    body: FontId;
    button: FontId;
  };
  weights: {
    heading: number; // 400..900
    body: number; // 300..900
    button: number; // 400..900
  };
  sizes: {
    base: number; // px (12..20)
    h1: number;
    h2: number;
    h3: number;
    body: number;
    small: number;
    button: number;
  };
  lineHeights: {
    heading: number; // 1.0..1.4
    body: number; // 1.2..1.8
    tight: number; // 1.0..1.2
  };
  letterSpacing: {
    heading: number; // -0.02..0.08 (em)
    body: number; // -0.02..0.08 (em)
    button: number; // -0.02..0.16 (em)
  };
};

export type ThemeSpacingV3 = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
};

export type ThemeRadiusV3 = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  full: number;
};

export type ShadowPresetId = "none" | "soft" | "medium" | "glow" | "luxury";
export type CardStyleId = "flat" | "elevated" | "bordered" | "glass" | "luxury";
export type ButtonStyleId = "filled" | "outline" | "soft" | "glass" | "gradient";
export type MotionPresetId = "disabled" | "subtle" | "smooth" | "energetic";

export type ThemeComponentsV3 = {
  buttons: {
    style: ButtonStyleId;
    radius: "xs" | "sm" | "md" | "lg" | "xl" | "full";
    paddingY: number; // px
    paddingX: number; // px
  };
  cards: {
    style: CardStyleId;
    radius: "xs" | "sm" | "md" | "lg" | "xl";
    shadow: ShadowPresetId;
    borderOpacity: number; // 0..0.3
  };
};

export type ThemeMotionV3 = {
  preset: MotionPresetId;
};

export type ThemeTokensV3 = {
  version: 3;
  density: ThemeDensity;
  palette: ThemePaletteV3;
  typography: ThemeTypographyV3;
  spacing: ThemeSpacingV3;
  radius: ThemeRadiusV3;
  components: ThemeComponentsV3;
  motion: ThemeMotionV3;
};

export type ResolvedThemeV3 = {
  tokens: ThemeTokensV3;
};

