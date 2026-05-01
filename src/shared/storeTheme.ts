/** Общие дефолты, готовые шаблоны и слияние темы витрины (backend + frontend). */

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
  layout: StoreLayout;
  banner: StoreBannerConfig;
};

export const STORE_TEMPLATE_IDS = ["red", "dark", "light", "luxury"] as const;

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

export const DEFAULT_STORE_THEME: ResolvedStoreTheme = {
  primaryColor: "#ef4444",
  bgColor: "#0f172a",
  cardColor: "#1e293b",
  textColor: "#ffffff",
  logoUrl: null,
  layout: "classic",
  banner: {
    enabled: true,
    title: "-10% на первый заказ",
    subtitle: "Промокод SHOP10",
  },
};

/** Готовые дизайны: цвета, баннер по умолчанию, layout (modern = более «воздушная» витрина). */
export const TEMPLATES: Record<StoreTemplateId, ResolvedStoreTheme> = {
  red: {
    primaryColor: "#dc2626",
    bgColor: "#1c0a0a",
    cardColor: "#2d1515",
    textColor: "#fef2f2",
    logoUrl: null,
    layout: "classic",
    banner: {
      enabled: true,
      title: "🔥 Скидка на первый заказ",
      subtitle: "Промокод RED10",
    },
  },
  dark: {
    primaryColor: "#38bdf8",
    bgColor: "#020617",
    cardColor: "#0f172a",
    textColor: "#e2e8f0",
    logoUrl: null,
    layout: "modern",
    banner: {
      enabled: true,
      title: "Ночной режим — бонус для вас",
      subtitle: "Код DARK10",
    },
  },
  light: {
    primaryColor: "#b91c1c",
    bgColor: "#f8fafc",
    cardColor: "#ffffff",
    textColor: "#0f172a",
    logoUrl: null,
    layout: "modern",
    banner: {
      enabled: true,
      title: "Добро пожаловать",
      subtitle: "Скидка 10% — LIGHT10",
    },
  },
  luxury: {
    primaryColor: "#d4af37",
    bgColor: "#0a0908",
    cardColor: "#1a1814",
    textColor: "#f5f0e6",
    logoUrl: null,
    layout: "classic",
    banner: {
      enabled: true,
      title: "Премиум-коллекция",
      subtitle: "Промокод GOLD10",
    },
  },
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
  };
}

/** База из шаблона или системный дефолт */
export function templatePresetResolved(
  templateId: string | null | undefined,
): ResolvedStoreTheme {
  const id = normTemplateId(templateId);
  if (id == null) return cloneResolved(DEFAULT_STORE_THEME);
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
  return mergeThemeFromUnknown(stored, base);
}

export function mergeThemeFromUnknown(
  stored: unknown,
  basePreset?: ResolvedStoreTheme,
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

  return {
    primaryColor: pickColor("primaryColor"),
    bgColor: pickColor("bgColor"),
    cardColor: pickColor("cardColor"),
    textColor: pickColor("textColor"),
    logoUrl,
    layout,
    banner,
  };
}

export type ThemePatchPayload = Partial<{
  primaryColor: string;
  bgColor: string;
  cardColor: string;
  textColor: string;
  logoUrl: string | null;
  layout: StoreLayout;
  templateId: string | null;
  banner: Partial<StoreBannerConfig>;
}>;
