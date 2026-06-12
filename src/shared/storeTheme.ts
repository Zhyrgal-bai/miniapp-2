/** Общие дефолты, готовые шаблоны и слияние темы витрины (backend + frontend). */

import { resolveThemeTokensV2 } from "../theme/resolver.js";
import { presetTokens } from "../theme/presets.js";
import type { ThemeTokensV2 } from "../theme/tokens.js";
import { resolveThemeTokensV3 } from "../themeSystem/resolveThemeV3.js";
import type { ThemeTokensV3 } from "../designTokens/v3/types.js";

export type StoreBannerConfig = {
  enabled: boolean;
  title: string;
  subtitle: string;
};

export type StoreLayout = "classic" | "modern";

export type ResolvedStoreTheme = {
  primaryColor: string;
  bgColor: string;
  cardColor: string;
  textColor: string;
  logoUrl: string | null;
  logoPublicId: string | null;
  layout: StoreLayout;
  banner: StoreBannerConfig;
  /** Design tokens v2 for builder/UX system (safe, schema-driven). */
  tokens: ThemeTokensV2;
  /** Theme tokens v3 (next-gen design system). Optional for backward compatibility. */
  tokensV3?: ThemeTokensV3;
};

export type { ThemeTokensV2 } from "../theme/tokens.js";

export const STORE_TEMPLATE_IDS = ["red", "dark", "light", "luxury", "minimal", "fashion", "neon"] as const;

export type StoreTemplateId = (typeof STORE_TEMPLATE_IDS)[number];

export function isStoreTemplateId(
  id: string | null | undefined,
): id is StoreTemplateId {
  if (id == null || id === "") return false;
  return (STORE_TEMPLATE_IDS as readonly string[]).includes(id.toLowerCase());
}

function normTemplateId(
  id: string | null | undefined,
): StoreTemplateId | null {
  if (id == null || id === "") return null;
  const t = id.trim().toLowerCase();
  return isStoreTemplateId(t) ? t : null;
}

/** Готовые дизайны: цвета, баннер по умолчанию, layout (modern = более «воздушная» витрина). */
export const TEMPLATES: Record<StoreTemplateId, ResolvedStoreTheme> = {
  red: {
    primaryColor: "#ef4444",
    bgColor: "#1a0000",
    cardColor: "#2a0000",
    textColor: "#ffffff",
    logoUrl: null,
    logoPublicId: null,
    layout: "classic",
    banner: {
      enabled: true,
      title: "🔥 Скидка на первый заказ",
      subtitle: "Промокод RED10",
    },
    tokens: presetTokens("red"),
  },
  dark: {
    primaryColor: "#6366f1",
    bgColor: "#0f172a",
    cardColor: "#1e293b",
    textColor: "#ffffff",
    logoUrl: null,
    logoPublicId: null,
    layout: "modern",
    banner: {
      enabled: true,
      title: "Ночной режим — бонус для вас",
      subtitle: "Код DARK10",
    },
    tokens: presetTokens("dark"),
  },
  light: {
    primaryColor: "#3b82f6",
    bgColor: "#ffffff",
    cardColor: "#f1f5f9",
    textColor: "#000000",
    logoUrl: null,
    logoPublicId: null,
    layout: "modern",
    banner: {
      enabled: true,
      title: "Добро пожаловать",
      subtitle: "Скидка 10% — LIGHT10",
    },
    tokens: presetTokens("light"),
  },
  luxury: {
    primaryColor: "#d4af37",
    bgColor: "#0a0908",
    cardColor: "#1a1814",
    textColor: "#f5f0e6",
    logoUrl: null,
    logoPublicId: null,
    layout: "classic",
    banner: {
      enabled: true,
      title: "Премиум-коллекция",
      subtitle: "Промокод GOLD10",
    },
    tokens: presetTokens("luxury"),
  },
  minimal: {
    primaryColor: "#3b82f6",
    bgColor: "#ffffff",
    cardColor: "#ffffff",
    textColor: "#0b1220",
    logoUrl: null,
    logoPublicId: null,
    layout: "modern",
    banner: {
      enabled: true,
      title: "Добро пожаловать",
      subtitle: "Скидка 10% — MIN10",
    },
    tokens: presetTokens("light"),
  },
  fashion: {
    primaryColor: "#ff3ea5",
    bgColor: "#07070a",
    cardColor: "#0f111a",
    textColor: "#ffffff",
    logoUrl: null,
    logoPublicId: null,
    layout: "modern",
    banner: {
      enabled: true,
      title: "New drop",
      subtitle: "Промокод FASHION10",
    },
    tokens: presetTokens("dark"),
  },
  neon: {
    primaryColor: "#22d3ee",
    bgColor: "#020617",
    cardColor: "#050b1a",
    textColor: "#e5f6ff",
    logoUrl: null,
    logoPublicId: null,
    layout: "modern",
    banner: {
      enabled: true,
      title: "Neon mode",
      subtitle: "Промокод NEON10",
    },
    tokens: presetTokens("dark"),
  },
};

/** Без `templateId` в БД — как в макете: база = шаблон dark. */
export const DEFAULT_STORE_THEME: ResolvedStoreTheme = {
  ...TEMPLATES.dark,
  banner: { ...TEMPLATES.dark.banner },
  tokens: { ...TEMPLATES.dark.tokens },
};

const HEX6 = /^#([0-9A-Fa-f]{6})$/;
const HEX3 = /^#([0-9A-Fa-f]{3})$/;

export function normalizeHexColor(input: string): string | null {
  const s = input.trim();
  if (HEX6.test(s)) return s.toLowerCase();
  const m3 = HEX3.exec(s);
  if (m3) {
    const [r, g, b] = m3[1]!.split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function cloneResolved(t: ResolvedStoreTheme): ResolvedStoreTheme {
  return {
    ...t,
    banner: { ...t.banner },
    tokens: JSON.parse(JSON.stringify(t.tokens)) as ThemeTokensV2,
  };
}

/** База из шаблона или системный дефолт */
export function templatePresetResolved(
  templateId: string | null | undefined,
): ResolvedStoreTheme {
  const id = normTemplateId(templateId);
  if (id == null) return cloneResolved(TEMPLATES.dark);
  return cloneResolved(TEMPLATES[id]);
}

/**
 * Итоговая тема: пресет по `templateId`, поверх него сохранённые поля из JSON `themeConfig`.
 */
export function resolveStoreTheme(
  templateId: string | null | undefined,
  stored: unknown,
): ResolvedStoreTheme {
  const base = templatePresetResolved(templateId);
  return mergeThemeFromUnknown(stored, base, templateId);
}

/**
 * @param rowTemplateId — `Business.templateId` из строки БД. В JSON `themeConfig` поля `templateId` нет,
 *   поэтому без этого аргумента `tokensV3` всегда резолвился как тёмный пресет и перекрывал цвета витрины.
 */
export function mergeThemeFromUnknown(
  stored: unknown,
  basePreset?: ResolvedStoreTheme,
  rowTemplateId?: string | null,
): ResolvedStoreTheme {
  const base = cloneResolved(basePreset ?? DEFAULT_STORE_THEME);
  if (!isPlainObject(stored)) return base;

  const pickColor = (
    key: keyof Pick<
      ResolvedStoreTheme,
      "primaryColor" | "bgColor" | "cardColor" | "textColor"
    >,
  ) => {
    const raw = stored[key];
    if (typeof raw !== "string") return base[key];
    const n = normalizeHexColor(raw);
    return n ?? base[key];
  };

  let logoUrl: string | null = base.logoUrl;
  const rawLogo = stored.logoUrl;
  if (rawLogo === null || rawLogo === "") logoUrl = null;
  else if (typeof rawLogo === "string") {
    const t = rawLogo.trim().slice(0, 2048);
    if (/^https:\/\/.+/i.test(t)) logoUrl = t;
    else logoUrl = base.logoUrl;
  }

  let logoPublicId: string | null = base.logoPublicId;
  const rawLogoPid = stored.logoPublicId;
  if (rawLogoPid === null || rawLogoPid === "") logoPublicId = null;
  else if (typeof rawLogoPid === "string") {
    const t = rawLogoPid.trim().slice(0, 512);
    logoPublicId = t !== "" ? t : null;
  }

  let layout: StoreLayout = base.layout;
  const rawLayout = stored.layout;
  if (rawLayout === "classic" || rawLayout === "modern") {
    layout = rawLayout;
  }

  let banner = { ...base.banner };
  const b = stored.banner;
  if (isPlainObject(b)) {
    if (typeof b.enabled === "boolean") banner.enabled = b.enabled;
    if (typeof b.title === "string") banner.title = b.title.slice(0, 280);
    if (typeof b.subtitle === "string")
      banner.subtitle = b.subtitle.slice(0, 280);
  }

  const tidFromStored =
    typeof (stored as { templateId?: unknown }).templateId === "string"
      ? (stored as { templateId: string }).templateId
      : null;
  const templateIdForTokens = normTemplateId(rowTemplateId ?? tidFromStored);

  const tokens = resolveThemeTokensV2({
    templateId: templateIdForTokens,
    stored,
  });

  const tokensV3 = resolveThemeTokensV3({
    templateId: templateIdForTokens,
    stored,
  });

  return {
    primaryColor: pickColor("primaryColor"),
    bgColor: pickColor("bgColor"),
    cardColor: pickColor("cardColor"),
    textColor: pickColor("textColor"),
    logoUrl,
    logoPublicId,
    layout,
    banner,
    tokens,
    tokensV3,
  };
}

export type ThemePatchPayload = Partial<{
  primaryColor: string;
  bgColor: string;
  cardColor: string;
  textColor: string;
  logoUrl: string | null;
  logoPublicId?: string | null;
  layout: StoreLayout;
  templateId: string | null;
  banner: Partial<StoreBannerConfig>;
}>;
