import type { ThemeTokensV2 } from "@repo-shared/storeTheme";

export type ThemePreset = {
  id: "minimal" | "darkCommerce" | "fashion" | "luxury" | "tech" | "neon";
  title: string;
  tokens: ThemeTokensV2;
  colors?: Partial<{
    primaryColor: string;
    bgColor: string;
    cardColor: string;
    textColor: string;
  }>;
};

const baseTokens: ThemeTokensV2 = {
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

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "minimal",
    title: "Minimal",
    colors: {
      primaryColor: "#3b82f6",
      bgColor: "#ffffff",
      cardColor: "#f1f5f9",
      textColor: "#0b1220",
    },
    tokens: {
      ...baseTokens,
      shadows: {
        sm: "0 2px 8px rgba(0,0,0,0.10)",
        md: "0 8px 24px rgba(0,0,0,0.14)",
        lg: "0 16px 48px rgba(0,0,0,0.18)",
      },
    },
  },
  {
    id: "darkCommerce",
    title: "Dark Commerce",
    colors: {
      primaryColor: "#ef4444",
      bgColor: "#0b0f1a",
      cardColor: "#0f172a",
      textColor: "#ffffff",
    },
    tokens: { ...baseTokens },
  },
  {
    id: "fashion",
    title: "Fashion",
    colors: {
      primaryColor: "#a855f7",
      bgColor: "#0b0f1a",
      cardColor: "#111827",
      textColor: "#ffffff",
    },
    tokens: { ...baseTokens, radius: { ...baseTokens.radius, md: 16, lg: 22 } },
  },
  {
    id: "luxury",
    title: "Luxury",
    colors: {
      primaryColor: "#d4af37",
      bgColor: "#0a0908",
      cardColor: "#1a1814",
      textColor: "#f5f0e6",
    },
    tokens: {
      ...baseTokens,
      typography: { ...baseTokens.typography, headingWeight: 900, bodyWeight: 500 },
      radius: { ...baseTokens.radius, md: 12, lg: 16 },
    },
  },
  {
    id: "tech",
    title: "Tech",
    colors: {
      primaryColor: "#22c55e",
      bgColor: "#0b0f1a",
      cardColor: "#0f172a",
      textColor: "#e5e7eb",
    },
    tokens: {
      ...baseTokens,
      typography: { ...baseTokens.typography, baseFontSize: 15 },
      button: { ...baseTokens.button, radius: 10 },
    },
  },
  {
    id: "neon",
    title: "Neon",
    colors: {
      primaryColor: "#22d3ee",
      bgColor: "#020617",
      cardColor: "#050b1a",
      textColor: "#e5f6ff",
    },
    tokens: {
      ...baseTokens,
      typography: { ...baseTokens.typography, baseFontSize: 15, headingWeight: 900 },
      radius: { ...baseTokens.radius, md: 14, lg: 20 },
      shadows: {
        sm: "0 2px 10px rgba(34,211,238,0.10)",
        md: "0 10px 26px rgba(34,211,238,0.14)",
        lg: "0 18px 60px rgba(34,211,238,0.18)",
      },
    },
  },
];

