import type { Prisma } from "@prisma/client";
import {
  mergeThemeFromUnknown,
  normalizeHexColor,
  resolveStoreTheme,
  isStoreTemplateId,
  TEMPLATES,
  type ResolvedStoreTheme,
  type ThemePatchPayload,
  type StoreTemplateId,
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

function cloneTheme(t: ResolvedStoreTheme): ResolvedStoreTheme {
  return { ...t, banner: { ...t.banner } };
}

function normalizeTemplateIdPatch(
  raw: unknown,
  current: string | null,
): { ok: true; templateId: string | null; changed: boolean } | { ok: false; error: string } {
  if (raw === undefined) {
    return {
      ok: true,
      templateId: current,
      changed: false,
    };
  }
  if (raw === null || raw === "") {
    const low = current?.trim().toLowerCase() ?? null;
    const nowNull = low == null || low === "";
    return {
      ok: true,
      templateId: null,
      changed: !nowNull,
    };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "templateId: строка или null" };
  }
  const t = raw.trim().toLowerCase();
  if (t === "") {
    return { ok: true, templateId: null, changed: current != null && current !== "" };
  }
  if (!isStoreTemplateId(t)) {
    return {
      ok: false,
      error: "Неизвестный шаблон. Допустимо: red, dark, light, luxury",
    };
  }
  const cur = current?.trim().toLowerCase() ?? null;
  return {
    ok: true,
    templateId: t,
    changed: cur !== t,
  };
}

/**
 * Сливает тему из БД + шаблон, применяет PATCH, возвращает JSON для `Business.themeConfig` и `templateId`.
 */
export function applyThemePatchAndValidate(
  currentJson: unknown,
  currentTemplateId: string | null | undefined,
  body: unknown,
):
  | {
      ok: true;
      themeConfig: Prisma.InputJsonValue;
      merged: ResolvedStoreTheme;
      templateId: string | null;
    }
  | { ok: false; error: string } {
  if (body !== null && typeof body !== "object") {
    return { ok: false, error: "Нужен объект themeConfig в теле" };
  }
  const patch = body as ThemePatchPayload;

  const curTid =
    currentTemplateId != null &&
    String(currentTemplateId).trim() !== "" &&
    isStoreTemplateId(String(currentTemplateId).trim().toLowerCase())
      ? (String(currentTemplateId).trim().toLowerCase() as StoreTemplateId)
      : null;

  const tidParsed = normalizeTemplateIdPatch(patch.templateId, curTid);
  if (!tidParsed.ok) return tidParsed;

  const nextTemplateId = tidParsed.templateId;

  let next: ResolvedStoreTheme;
  if (tidParsed.changed && nextTemplateId != null) {
    const prev = resolveStoreTheme(curTid, currentJson);
    const tpl = TEMPLATES[nextTemplateId as StoreTemplateId];
    next = cloneTheme({
      ...tpl,
      logoUrl: prev.logoUrl,
      banner: { ...tpl.banner },
    });
  } else if (tidParsed.changed && nextTemplateId == null) {
    next = mergeThemeFromUnknown(currentJson);
  } else {
    next = resolveStoreTheme(nextTemplateId, currentJson);
  }

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
  if (
    logoSan === undefined &&
    patch.logoUrl !== undefined &&
    patch.logoUrl !== null
  ) {
    return { ok: false, error: "logoUrl должен быть https:// или пусто" };
  }
  if (logoSan !== undefined) {
    next.logoUrl = logoSan;
  }

  if (patch.layout !== undefined) {
    if (patch.layout !== "classic" && patch.layout !== "modern") {
      return { ok: false, error: "layout: classic или modern" };
    }
    next.layout = patch.layout;
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
    layout: next.layout,
    banner: {
      enabled: next.banner.enabled,
      title: next.banner.title,
      subtitle: next.banner.subtitle,
    },
  };

  return {
    ok: true,
    themeConfig,
    merged: next,
    templateId: nextTemplateId,
  };
}

export function publicBusinessThemeResponse(
  themeConfig: unknown,
  settingsLogoUrl: string | null | undefined,
  templateId: string | null | undefined,
): { themeConfig: ResolvedStoreTheme; templateId: string | null } {
  const merged = resolveStoreTheme(templateId, themeConfig);
  const logo =
    merged.logoUrl ??
    (typeof settingsLogoUrl === "string" && settingsLogoUrl.trim() !== ""
      ? settingsLogoUrl.trim()
      : null);
  const tidRaw =
    templateId != null && String(templateId).trim() !== ""
      ? String(templateId).trim().toLowerCase()
      : null;
  const templateIdClean =
    tidRaw != null && isStoreTemplateId(tidRaw) ? tidRaw : null;
  return {
    themeConfig: {
      ...merged,
      logoUrl: logo,
    },
    templateId: templateIdClean,
  };
}

export {
  mergeThemeFromUnknown,
  resolveStoreTheme,
  TEMPLATES,
};
