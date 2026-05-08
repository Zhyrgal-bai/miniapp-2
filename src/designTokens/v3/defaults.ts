import type { ThemeTokensV3 } from "./types.js";

export function defaultThemeTokensV3(): ThemeTokensV3 {
  return {
    version: 3,
    density: "normal",
    palette: {
      primary: "#6366f1",
      secondary: "#22c55e",
      accent: "#f97316",
      background: "#0f172a",
      surface: "#111827",
      surfaceAlt: "#1f2937",
      border: "#334155",
      card: "#1e293b",
      text: "#ffffff",
      muted: "#94a3b8",
      success: "#22c55e",
      warning: "#f59e0b",
      danger: "#ef4444",
    },
    typography: {
      fonts: { heading: "system", body: "system", button: "system" },
      weights: { heading: 800, body: 500, button: 700 },
      sizes: { base: 16, h1: 28, h2: 22, h3: 18, body: 16, small: 13, button: 15 },
      lineHeights: { heading: 1.15, body: 1.45, tight: 1.05 },
      letterSpacing: { heading: -0.01, body: 0, button: 0.02 },
    },
    spacing: { xs: 6, sm: 10, md: 16, lg: 24, xl: 32, xxl: 40 },
    radius: { xs: 8, sm: 10, md: 14, lg: 18, xl: 24, full: 999 },
    components: {
      buttons: { style: "filled", radius: "md", paddingY: 12, paddingX: 16 },
      cards: { style: "elevated", radius: "lg", shadow: "medium", borderOpacity: 0.08 },
    },
    motion: { preset: "smooth" },
  };
}

