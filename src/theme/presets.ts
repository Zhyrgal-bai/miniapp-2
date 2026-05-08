import { defaultThemeTokens, type ThemeTokensV2 } from "./tokens.js";

export type ThemePresetId = "red" | "dark" | "light" | "luxury";

export function presetTokens(id: ThemePresetId): ThemeTokensV2 {
  const base = defaultThemeTokens();
  switch (id) {
    case "light":
      return {
        ...base,
        shadows: {
          sm: "0 2px 8px rgba(0,0,0,0.10)",
          md: "0 8px 24px rgba(0,0,0,0.14)",
          lg: "0 16px 48px rgba(0,0,0,0.18)",
        },
        gradients: {
          ...base.gradients,
          header:
            "linear-gradient(90deg, rgba(255,255,255,0.92) 0%, rgba(241,245,249,0.92) 100%)",
        },
      };
    case "luxury":
      return {
        ...base,
        typography: {
          ...base.typography,
          headingWeight: 900,
        },
        radius: { ...base.radius, md: 12, lg: 16 },
        gradients: {
          ...base.gradients,
          hero:
            "linear-gradient(135deg, rgba(212,175,55,0.18) 0%, rgba(10,9,8,0.10) 100%)",
        },
      };
    case "red":
      return {
        ...base,
        gradients: {
          ...base.gradients,
          hero:
            "linear-gradient(135deg, rgba(239,68,68,0.22) 0%, rgba(99,102,241,0.10) 100%)",
        },
      };
    case "dark":
    default:
      return base;
  }
}
