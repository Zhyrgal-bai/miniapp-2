import { apiAbsoluteUrl } from "./api";
import { adminFetch } from "./adminRequest";
import { formatAdminApiError } from "../utils/adminApiError";
import type {
  ResolvedStoreTheme,
  StoreTemplateId,
  ThemePatchPayload,
} from "@repo-shared/storeTheme";
import { withTenantHeaders } from "./api";

export type BusinessPublicPayload = {
  id: number;
  name: string;
  themeConfig: ResolvedStoreTheme;
  templateId: string | null;
};

export async function fetchBusinessPublic(
  businessId: number,
): Promise<BusinessPublicPayload> {
  const url = apiAbsoluteUrl(`/api/business/${businessId}`);
  const res = await fetch(url, {
    cache: "no-store",
    headers: withTenantHeaders(undefined, url, { businessId }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(formatAdminApiError(new Error(t || `HTTP ${res.status}`)));
  }
  return res.json() as Promise<BusinessPublicPayload>;
}

async function readThemeResponse(res: Response): Promise<{
  themeConfig: ResolvedStoreTheme;
  templateId: string | null;
}> {
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text) as { themeConfig?: ResolvedStoreTheme; error?: string };
  } catch {
    body = null;
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("themeConfig" in body) ||
    body.themeConfig === null
  ) {
    const err =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof (body as { error?: string }).error === "string"
        ? (body as { error: string }).error
        : text;
    throw new Error(formatAdminApiError(new Error(err || "Ответ без themeConfig")));
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

export async function saveBusinessThemePut(
  businessId: number,
  patch: ThemePatchPayload,
): Promise<{ themeConfig: ResolvedStoreTheme; templateId: string | null }> {
  const url = new URL(
    apiAbsoluteUrl(`/api/business/${businessId}/theme`),
  );
  url.searchParams.set("shop", String(businessId));

  const res = await adminFetch(url.toString(), {
    method: "PUT",
    businessId,
    body: JSON.stringify(patch),
  });
  return readThemeResponse(res);
}

/** Только смена `templateId` (PUT /api/business/template) — полная тема с сервера. */
export async function saveBusinessTemplateId(
  businessId: number,
  templateId: StoreTemplateId,
): Promise<{ themeConfig: ResolvedStoreTheme; templateId: string | null }> {
  const url = new URL(apiAbsoluteUrl("/api/business/template"));
  url.searchParams.set("shop", String(businessId));

  const res = await adminFetch(url.toString(), {
    method: "PUT",
    businessId,
    body: JSON.stringify({ templateId }),
  });
  return readThemeResponse(res);
}
