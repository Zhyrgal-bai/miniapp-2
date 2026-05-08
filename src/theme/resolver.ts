import { presetTokens, type ThemePresetId } from "./presets.js";
import { defaultThemeTokens, type ThemeTokensV2 } from "./tokens.js";
import { normalizeThemeTokensV2 } from "./validators.js";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function tokensPresetResolved(templateId: string | null | undefined): ThemeTokensV2 {
  const t = typeof templateId === "string" ? templateId.trim().toLowerCase() : "";
  const id: ThemePresetId =
    t === "red" || t === "dark" || t === "light" || t === "luxury" ? (t as ThemePresetId) : "dark";
  return presetTokens(id);
}

export function resolveThemeTokensV2(params: {
  templateId: string | null | undefined;
  stored: unknown;
}): ThemeTokensV2 {
  const base = tokensPresetResolved(params.templateId);
  if (!isPlainObject(params.stored)) return base;
  const rawTokens = (params.stored as Record<string, unknown>).tokens;
  return normalizeThemeTokensV2(rawTokens, base);
}

export function defaultTokens(): ThemeTokensV2 {
  return defaultThemeTokens();
}

