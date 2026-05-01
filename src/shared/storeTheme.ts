/** Общие дефолты и слияние темы витрины (backend + frontend). */

export type StoreBannerConfig = {
  enabled: boolean;
  title: string;
  subtitle: string;
};

export type ResolvedStoreTheme = {
  primaryColor: string;
  bgColor: string;
  cardColor: string;
  textColor: string;
  logoUrl: string | null;
  banner: StoreBannerConfig;
};

export const DEFAULT_STORE_THEME: ResolvedStoreTheme = {
  primaryColor: "#ef4444",
  bgColor: "#0f172a",
  cardColor: "#1e293b",
  textColor: "#ffffff",
  logoUrl: null,
  banner: {
    enabled: true,
    title: "-10% на первый заказ",
    subtitle: "Промокод SHOP10",
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

export function mergeThemeFromUnknown(stored: unknown): ResolvedStoreTheme {
  const base = { ...DEFAULT_STORE_THEME, banner: { ...DEFAULT_STORE_THEME.banner } };
  if (!isPlainObject(stored)) return base;

  const pickColor = (key: keyof Pick<ResolvedStoreTheme, "primaryColor" | "bgColor" | "cardColor" | "textColor">) => {
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

  let banner = { ...base.banner };
  const b = stored.banner;
  if (isPlainObject(b)) {
    if (typeof b.enabled === "boolean") banner.enabled = b.enabled;
    if (typeof b.title === "string") banner.title = b.title.slice(0, 280);
    if (typeof b.subtitle === "string") banner.subtitle = b.subtitle.slice(0, 280);
  }

  return {
    primaryColor: pickColor("primaryColor"),
    bgColor: pickColor("bgColor"),
    cardColor: pickColor("cardColor"),
    textColor: pickColor("textColor"),
    logoUrl,
    banner,
  };
}

export type ThemePatchPayload = Partial<{
  primaryColor: string;
  bgColor: string;
  cardColor: string;
  textColor: string;
  logoUrl: string | null;
  banner: Partial<StoreBannerConfig>;
}>;
