import { defaultThemeTokensV3 } from "./defaults.js";
import type { ThemeTokensV3 } from "./types.js";

export type ThemePresetV3Id =
  | "darkCommerce"
  | "lightMinimal"
  | "redBold"
  | "luxuryGold"
  | "fashionVibe"
  | "neonGlow";

export function presetTokensV3(id: ThemePresetV3Id): ThemeTokensV3 {
  const base = defaultThemeTokensV3();
  switch (id) {
    case "lightMinimal":
      return {
        ...base,
        palette: {
          ...base.palette,
          background: "#ffffff",
          surface: "#f8fafc",
          surfaceAlt: "#f1f5f9",
          card: "#ffffff",
          border: "#e2e8f0",
          text: "#0b1220",
          muted: "#64748b",
          primary: "#3b82f6",
          secondary: "#22c55e",
          accent: "#a855f7",
        },
        components: {
          ...base.components,
          cards: { ...base.components.cards, style: "bordered", shadow: "none", borderOpacity: 0.12 },
        },
      };
    case "redBold":
      return {
        ...base,
        palette: {
          ...base.palette,
          primary: "#ef4444",
          accent: "#f97316",
          background: "#1a0000",
          surface: "#200000",
          surfaceAlt: "#2a0000",
          card: "#2a0000",
          border: "#3a0a0a",
        },
        motion: { preset: "energetic" },
      };
    case "luxuryGold":
      return {
        ...base,
        palette: {
          ...base.palette,
          primary: "#d4af37",
          secondary: "#a78bfa",
          accent: "#f59e0b",
          background: "#0a0908",
          surface: "#0f0e0c",
          surfaceAlt: "#171612",
          card: "#1a1814",
          border: "#2b2a25",
          text: "#f5f0e6",
          muted: "#c7bda8",
        },
        typography: {
          ...base.typography,
          fonts: { heading: "playfairDisplay", body: "manrope", button: "montserrat" },
          weights: { heading: 800, body: 500, button: 700 },
          letterSpacing: { heading: 0.01, body: 0, button: 0.06 },
          sizes: { ...base.typography.sizes, h1: 30, h2: 24, h3: 19, button: 14 },
        },
        components: {
          ...base.components,
          cards: { ...base.components.cards, style: "luxury", shadow: "luxury", borderOpacity: 0.10 },
          buttons: { ...base.components.buttons, style: "gradient", radius: "lg" },
        },
        motion: { preset: "subtle" },
      };
    case "fashionVibe":
      return {
        ...base,
        density: "comfortable",
        palette: {
          ...base.palette,
          primary: "#ff3ea5",
          secondary: "#a855f7",
          accent: "#22c55e",
          background: "#07070a",
          surface: "#0b0b12",
          surfaceAlt: "#10101a",
          card: "#0f111a",
          border: "#1e2233",
          text: "#ffffff",
          muted: "#a1a1aa",
        },
        typography: {
          ...base.typography,
          fonts: { heading: "montserrat", body: "inter", button: "montserrat" },
          weights: { heading: 900, body: 500, button: 800 },
          letterSpacing: { heading: 0.04, body: 0, button: 0.08 },
          sizes: { ...base.typography.sizes, base: 16, h1: 34, h2: 26, h3: 20, button: 15 },
        },
        radius: { ...base.radius, sm: 14, md: 18, lg: 24, xl: 28 },
        components: {
          ...base.components,
          cards: { ...base.components.cards, style: "elevated", shadow: "glow", borderOpacity: 0.10 },
          buttons: { ...base.components.buttons, style: "filled", radius: "full", paddingY: 12, paddingX: 18 },
        },
        motion: { preset: "energetic" },
      };
    case "neonGlow":
      return {
        ...base,
        density: "compact",
        palette: {
          ...base.palette,
          primary: "#22d3ee",
          secondary: "#a78bfa",
          accent: "#f472b6",
          background: "#020617",
          surface: "#050a1a",
          surfaceAlt: "#061027",
          card: "#050b1a",
          border: "#12304a",
          text: "#e5f6ff",
          muted: "#7dd3fc",
        },
        typography: {
          ...base.typography,
          fonts: { heading: "montserrat", body: "inter", button: "montserrat" },
          weights: { heading: 900, body: 500, button: 900 },
          letterSpacing: { heading: 0.06, body: 0, button: 0.10 },
          sizes: { ...base.typography.sizes, base: 15, h1: 30, h2: 22, h3: 18, button: 14 },
        },
        radius: { ...base.radius, xs: 10, sm: 12, md: 16, lg: 20, xl: 26 },
        components: {
          ...base.components,
          cards: { ...base.components.cards, style: "bordered", shadow: "none", borderOpacity: 0.22 },
          buttons: { ...base.components.buttons, style: "outline", radius: "lg", paddingY: 11, paddingX: 16 },
        },
        motion: { preset: "smooth" },
      };
    case "darkCommerce":
    default:
      return base;
  }
}

