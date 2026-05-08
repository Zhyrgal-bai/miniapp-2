import { presetTokensV3, type ThemePresetV3Id } from "../designTokens/v3/presets.js";
import { defaultThemeTokensV3 } from "../designTokens/v3/defaults.js";
import { normalizeThemeTokensV3 } from "../designTokens/v3/normalize.js";
import type { ThemeTokensV3 } from "../designTokens/v3/types.js";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function presetFromLegacyTemplateId(templateId: string | null | undefined): ThemePresetV3Id {
  const t = typeof templateId === "string" ? templateId.trim().toLowerCase() : "";
  if (t === "light") return "lightMinimal";
  if (t === "red") return "redBold";
  if (t === "luxury") return "luxuryGold";
  return "darkCommerce";
}

/**
 * Resolves ThemeTokensV3 from stored themeConfig.
 * Backward compatible: if `tokensV3` missing, returns a safe default preset.
 */
export function resolveThemeTokensV3(params: {
  templateId: string | null | undefined;
  stored: unknown;
}): ThemeTokensV3 {
  const presetId = presetFromLegacyTemplateId(params.templateId);
  const base = normalizeThemeTokensV3(
    presetTokensV3(presetId),
    defaultThemeTokensV3(),
  );

  if (!isPlainObject(params.stored)) return base;
  const raw = (params.stored as any).tokensV3;
  return normalizeThemeTokensV3(raw, base);
}

