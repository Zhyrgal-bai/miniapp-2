import type { Prisma } from "@prisma/client";
import {
  DEFAULT_STORE_THEME,
  mergeThemeFromUnknown,
  normalizeHexColor,
  type ResolvedStoreTheme,
  type ThemePatchPayload,
} from "../shared/storeTheme.js";

function stripText(s: string, max: number): string {
  return s.replace(/[\u0000-\u001F<>]/g, "").trim().slice(0, max);
}

function sanitizeLogoUrl(raw: unknown): string | null | undefined {
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().slice(0, 2048);
  if (t === "") return null;
  if (!/^https:\/\/.+/i.test(t)) return undefined;
  return t;
}

/**
 * Сливает сохранённую тему из БД с телом PUT, валидирует и возвращает JSON для `Business.themeConfig`.
 */
export function applyThemePatchAndValidate(
  currentJson: unknown,
  body: unknown,
):
  | { ok: true; themeConfig: Prisma.InputJsonValue; merged: ResolvedStoreTheme }
  | { ok: false; error: string } {
  const current = mergeThemeFromUnknown(currentJson);
  if (body !== null && typeof body !== "object") {
    return { ok: false, error: "Нужен объект themeConfig в теле" };
  }
  const patch = body as ThemePatchPayload;

  let next = { ...current, banner: { ...current.banner } };

  const colors: (keyof Pick<
    ResolvedStoreTheme,
    "primaryColor" | "bgColor" | "cardColor" | "textColor"
  >)[] = ["primaryColor", "bgColor", "cardColor", "textColor"];
  for (const k of colors) {
    if (patch[k] === undefined) continue;
    if (typeof patch[k] !== "string") {
      return { ok: false, error: `Некорректное поле ${k}` };
    }
    const n = normalizeHexColor(patch[k]!);
    if (!n) {
      return { ok: false, error: `${k}: укажите цвет в формате #RRGGBB` };
    }
    next[k] = n;
  }

  const logoSan = sanitizeLogoUrl(patch.logoUrl);
  if (logoSan === undefined && patch.logoUrl !== undefined && patch.logoUrl !== null) {
    return { ok: false, error: "logoUrl должен быть https:// или пусто" };
  }
  if (logoSan !== undefined) {
    next.logoUrl = logoSan;
  }

  if (patch.banner !== undefined) {
    if (patch.banner === null || typeof patch.banner !== "object") {
      return { ok: false, error: "banner должен быть объектом" };
    }
    const b = patch.banner;
    if (b.enabled !== undefined) {
      if (typeof b.enabled !== "boolean") {
        return { ok: false, error: "banner.enabled: boolean" };
      }
      next.banner.enabled = b.enabled;
    }
    if (b.title !== undefined) {
      if (typeof b.title !== "string") {
        return { ok: false, error: "banner.title: строка" };
      }
      next.banner.title = stripText(b.title, 280);
    }
    if (b.subtitle !== undefined) {
      if (typeof b.subtitle !== "string") {
        return { ok: false, error: "banner.subtitle: строка" };
      }
      next.banner.subtitle = stripText(b.subtitle, 280);
    }
  }

  const themeConfig: Prisma.InputJsonValue = {
    primaryColor: next.primaryColor,
    bgColor: next.bgColor,
    cardColor: next.cardColor,
    textColor: next.textColor,
    logoUrl: next.logoUrl,
    banner: {
      enabled: next.banner.enabled,
      title: next.banner.title,
      subtitle: next.banner.subtitle,
    },
  };

  return { ok: true, themeConfig, merged: next };
}

export function publicBusinessThemeResponse(
  themeConfig: unknown,
  settingsLogoUrl: string | null | undefined,
): { themeConfig: ResolvedStoreTheme } {
  const merged = mergeThemeFromUnknown(themeConfig);
  const logo =
    merged.logoUrl ??
    (typeof settingsLogoUrl === "string" && settingsLogoUrl.trim() !== ""
      ? settingsLogoUrl.trim()
      : null);
  return {
    themeConfig: {
      ...merged,
      logoUrl: logo,
    },
  };
}

export { DEFAULT_STORE_THEME, mergeThemeFromUnknown };
