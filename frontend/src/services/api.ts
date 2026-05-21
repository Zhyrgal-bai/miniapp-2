import axios, { AxiosHeaders } from "axios";
import { getBusinessIdNumber } from "../utils/storeParams";
import { telegramWebAppInitDataHeader } from "../utils/telegramInitDataHeader";
import { waitForTelegramInitData } from "../utils/waitForTelegramInitData";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

/** Убираем хвост `/api`, чтобы пути вроде `/categories` не превращались в `/api/categories` (404). */
function normalizeApiRoot(url: string): string {
  const trimmed = normalizeBaseUrl(url);
  if (trimmed.endsWith("/api")) {
    return trimmed.slice(0, -4);
  }
  return trimmed;
}

const envUrl =
  typeof import.meta.env.VITE_API_URL === "string"
    ? import.meta.env.VITE_API_URL.trim()
    : "";

const envFallbackUrl =
  typeof import.meta.env.VITE_FALLBACK_API_URL === "string"
    ? import.meta.env.VITE_FALLBACK_API_URL.trim()
    : "";

const DEFAULT_RENDER_API_ORIGIN = "https://miniapp-store.onrender.com";

/** База API: задайте `VITE_API_URL` в `frontend/.env` (тот же публичный URL, что `API_URL` на бэкенде). */
export const API_BASE_URL =
  envUrl !== "" ? normalizeApiRoot(envUrl) : "";

let warnedEmptyApiBase = false;

/**
 * Абсолютный URL эндпоинта (axios с baseURL игнорирует свой baseURL для absolute URL).
 * Используй для путей, которые должны гарантированно попасть на бэкенд.
 *
 * Если `VITE_API_URL` не был задан **на сборке** (например Vercel без env),
 * здесь получится относительный `/api/...` → браузер бьёт в origin фронта, а не в Render → initData/API «не работают».
 */
export function apiAbsoluteUrl(path: string): string {
  const vercelLikelyHost =
    typeof window !== "undefined" && /\.vercel\.app$/i.test(window.location.hostname);
  const fallbackBase =
    envFallbackUrl !== ""
      ? normalizeApiRoot(envFallbackUrl)
      : vercelLikelyHost
        ? DEFAULT_RENDER_API_ORIGIN
        : "";
  const base = normalizeBaseUrl(API_BASE_URL || fallbackBase);
  const p = path.startsWith("/") ? path : `/${path}`;
  if (
    base === "" &&
    !warnedEmptyApiBase &&
    (path.includes("/api/") ||
      path === "/categories" ||
      path.startsWith("/categories/"))
  ) {
    warnedEmptyApiBase = true;
    if (typeof console !== "undefined" && typeof console.error === "function") {
      console.error(
        "[api] При сборке не задан VITE_API_URL — запросы идут на текущий хост SPA, сервер Mini App не вызывается. " +
          "Задайте на Vercel переменную VITE_API_URL = публичный URL API (например https://your-app.onrender.com) без / в конце и пересоберите.",
      );
    }
  }
  return `${base}${p}`;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 30_000) || 30_000,
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (
      axios.isAxiosError(error) &&
      (!error.response ||
        error.code === "ERR_NETWORK" ||
        error.code === "ECONNABORTED")
    ) {
      error.message = "Ошибка сети. Проверьте подключение и попробуйте снова.";
    }
    return Promise.reject(error);
  },
);

export const TENANT_HEADER = "x-business-id";

export const TENANT_MISSING_ERROR =
  "Магазин не найден. Откройте Mini App через ссылку ?shop=<id> или Telegram start_param.";

/** Источник tenant НЕ из React state: Telegram start_param → URL → sessionStorage. */
export function getCurrentBusinessId(): number | null {
  return getBusinessIdNumber();
}

function isPlatformAdminPath(pathname: string): boolean {
  return pathname.startsWith("/api/platform/admin/");
}

function isPublicStorefrontPath(pathname: string): boolean {
  if (/^\/api\/storefront\/by-slug\/[^/]+$/i.test(pathname)) return true;
  if (/^\/api\/storefront\/\d+$/i.test(pathname)) return true;
  return false;
}

export function isTenantScopedPath(pathname: string): boolean {
  if (!pathname.startsWith("/")) return false;
  if (isPlatformAdminPath(pathname)) return false;
  if (isPublicStorefrontPath(pathname)) return false;
  return (
    pathname.startsWith("/api/storefront/") ||
    pathname.startsWith("/api/business/") ||
    pathname.startsWith("/api/merchant/") ||
    pathname === "/categories" ||
    pathname.startsWith("/categories/") ||
    pathname === "/upload" ||
    pathname === "/products/upload-images" ||
    pathname === "/products" ||
    pathname.startsWith("/products/") ||
    pathname === "/orders" ||
    pathname.startsWith("/orders/") ||
    pathname === "/analytics" ||
    pathname.startsWith("/analytics/") ||
    pathname.startsWith("/support/") ||
    pathname.startsWith("/merchant/")
  );
}

function toPathname(urlOrPath: string): string {
  const raw = String(urlOrPath ?? "").trim();
  if (raw === "") return "";
  try {
    // Relative URLs are resolved against current origin.
    const u = new URL(
      raw,
      typeof window !== "undefined" ? window.location.origin : "http://localhost",
    );
    return u.pathname || "";
  } catch {
    return "";
  }
}

function hasTenantHeader(headers: unknown): boolean {
  if (!headers) return false;
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.has(TENANT_HEADER);
  }
  if (Array.isArray(headers)) {
    return headers.some(
      (kv) => Array.isArray(kv) && String(kv[0]).toLowerCase() === TENANT_HEADER,
    );
  }
  if (typeof headers === "object") {
    return Object.keys(headers as Record<string, unknown>).some(
      (k) => k.toLowerCase() === TENANT_HEADER,
    );
  }
  return false;
}

export function withTenantHeaders(
  headers: HeadersInit | undefined,
  urlOrPath: string,
  opts?: { businessId?: number | null; requireTenant?: boolean },
): HeadersInit {
  const pathname = toPathname(urlOrPath);
  const tenantScoped = isTenantScopedPath(pathname);
  if (!tenantScoped) return headers ?? {};

  if (hasTenantHeader(headers)) return headers ?? {};

  const businessId =
    typeof opts?.businessId === "number" ? opts.businessId : getCurrentBusinessId();

  if (!businessId || !Number.isInteger(businessId) || businessId <= 0) {
    if (opts?.requireTenant !== false) {
      throw new Error(TENANT_MISSING_ERROR);
    }
    return headers ?? {};
  }

  const out: Record<string, string> = {};
  if (headers) {
    if (typeof Headers !== "undefined" && headers instanceof Headers) {
      headers.forEach((v, k) => {
        out[k] = v;
      });
    } else if (Array.isArray(headers)) {
      for (const kv of headers) {
        if (Array.isArray(kv) && kv.length >= 2) {
          out[String(kv[0])] = String(kv[1]);
        }
      }
    } else if (typeof headers === "object") {
      Object.assign(out, headers as Record<string, string>);
    }
  }
  out[TENANT_HEADER] = String(businessId);
  return out;
}

api.interceptors.request.use(async (config) => {
  const url = typeof config.url === "string" ? config.url : "";
  const base =
    typeof config.baseURL === "string" && config.baseURL.trim() !== ""
      ? config.baseURL
      : (API_BASE_URL || "");
  const full = (() => {
    try {
      return new URL(
        url,
        base || (typeof window !== "undefined" ? window.location.origin : "http://localhost"),
      ).toString();
    } catch {
      return url;
    }
  })();
  const pathname = toPathname(full);
  if (!isTenantScopedPath(pathname)) return config;

  const existing = config.headers;
  const alreadySet =
    existing != null &&
    typeof existing === "object" &&
    Object.keys(existing as Record<string, unknown>).some(
      (k) => k.toLowerCase() === TENANT_HEADER,
    );
  if (alreadySet) return config;

  const businessId = getCurrentBusinessId();
  if (!businessId || !Number.isInteger(businessId) || businessId <= 0) {
    // Prevent broken tenant-scoped requests (backend returns 400 otherwise).
    throw new Error(TENANT_MISSING_ERROR);
  }

  const bid = String(businessId);
  await waitForTelegramInitData({ maxAttempts: 12, delayMs: 100 });
  const initData = telegramWebAppInitDataHeader()["x-telegram-init-data"];
  if (existing instanceof AxiosHeaders) {
    existing.set(TENANT_HEADER, bid);
    existing.set("x-telegram-init-data", initData);
    config.headers = existing;
    return config;
  }

  const h = new AxiosHeaders(
    (existing as Record<string, string> | undefined) ?? {},
  );
  h.set(TENANT_HEADER, bid);
  h.set("x-telegram-init-data", initData);
  config.headers = h;
  return config;
});
