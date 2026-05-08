import { defaultThemeTokensV3 } from "./defaults.js";
import type { ThemeTokensV3 } from "./types.js";

export type ThemePresetV3Id = "darkCommerce" | "lightMinimal" | "redBold" | "luxuryGold";

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
        },
        components: {
          ...base.components,
          cards: { ...base.components.cards, style: "luxury", shadow: "luxury", borderOpacity: 0.10 },
          buttons: { ...base.components.buttons, style: "gradient", radius: "lg" },
        },
        motion: { preset: "subtle" },
      };
    case "darkCommerce":
    default:
      return base;
  }
}

