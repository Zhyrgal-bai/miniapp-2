import { apiAbsoluteUrl } from "./api";
import { getWebAppUserId } from "../utils/telegramUserId";
import type {
  ResolvedStoreTheme,
  StoreTemplateId,
  ThemePatchPayload,
} from "@repo-shared/storeTheme";

export type BusinessPublicPayload = {
  id: number;
  name: string;
  themeConfig: ResolvedStoreTheme;
  templateId: string | null;
};

export async function fetchBusinessPublic(
  businessId: number,
): Promise<BusinessPublicPayload> {
  const res = await fetch(apiAbsoluteUrl(`/api/business/${businessId}`));
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `HTTP ${res.status}`);
  }
  return res.json() as Promise<BusinessPublicPayload>;
}

export async function saveBusinessThemePut(
  businessId: number,
  patch: ThemePatchPayload,
): Promise<{ themeConfig: ResolvedStoreTheme; templateId: string | null }> {
  const userId = getWebAppUserId();
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error("Откройте в Telegram Mini App");
  }
  const url = new URL(
    apiAbsoluteUrl(`/api/business/${businessId}/theme`),
  );
  url.searchParams.set("shop", String(businessId));
  url.searchParams.set("userId", String(userId));

  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text) as { themeConfig?: ResolvedStoreTheme; error?: string };
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof (body as { error?: string }).error === "string"
        ? (body as { error: string }).error
        : text;
    throw new Error(err || `HTTP ${res.status}`);
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("themeConfig" in body) ||
    body.themeConfig === null
  ) {
    throw new Error("Ответ без themeConfig");
  }
  const typed = body as {
    themeConfig: ResolvedStoreTheme;
    templateId?: string | null;
  };
  const tid =
    typed.templateId !== undefined && typed.templateId !== null
      ? String(typed.templateId).trim().toLowerCase()
      : null;
  return {
    themeConfig: typed.themeConfig,
    templateId: tid,
  };
}

/** Только смена `templateId` (PUT /api/business/template) — полная тема с сервера. */
export async function saveBusinessTemplateId(
  businessId: number,
  templateId: StoreTemplateId,
): Promise<{ themeConfig: ResolvedStoreTheme; templateId: string | null }> {
  const userId = getWebAppUserId();
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error("Откройте в Telegram Mini App");
  }
  const url = new URL(apiAbsoluteUrl("/api/business/template"));
  url.searchParams.set("shop", String(businessId));
  url.searchParams.set("userId", String(userId));

  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId }),
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text) as {
      themeConfig?: ResolvedStoreTheme;
      templateId?: string | null;
      error?: string;
    };
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof (body as { error?: string }).error === "string"
        ? (body as { error: string }).error
        : text;
    throw new Error(err || `HTTP ${res.status}`);
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("themeConfig" in body) ||
    body.themeConfig === null
  ) {
    throw new Error("Ответ без themeConfig");
  }
  const typed = body as {
    themeConfig: ResolvedStoreTheme;
    templateId?: string | null;
  };
  const tid =
    typed.templateId !== undefined && typed.templateId !== null
      ? String(typed.templateId).trim().toLowerCase()
      : null;
  return { themeConfig: typed.themeConfig, templateId: tid };
}
