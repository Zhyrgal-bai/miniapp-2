import type { FinikCreateApiMode } from "./finikCreateTypes.js";
import { isFinikRsaPrivateKeyConfigured } from "./finikRsaSigning.js";

const VALID_MODES = new Set<FinikCreateApiMode>(["legacy", "official", "auto"]);

/** `FINIK_CREATE_API_MODE` — default `legacy` (official не включён в scaffold-релизе). */
export function getFinikCreateApiMode(): FinikCreateApiMode {
  const raw = (process.env.FINIK_CREATE_API_MODE ?? "legacy").trim().toLowerCase();
  if (VALID_MODES.has(raw as FinikCreateApiMode)) {
    return raw as FinikCreateApiMode;
  }
  return "legacy";
}

export function getLegacyFinikApiBaseUrl(): string {
  return (process.env.FINIK_API_BASE_URL || "https://api.finik.kg")
    .trim()
    .replace(/\/$/, "");
}

export function getLegacyFinikCreatePaymentPath(): string {
  const p = (process.env.FINIK_API_CREATE_PAYMENT_PATH || "/payments").trim();
  return p.startsWith("/") ? p : `/${p}`;
}

/** Normalize base URL; tolerate FINIK_API_URL ending with `/payment`. */
function normalizeOfficialAcquiringBaseUrl(raw: string): string {
  let url = raw.trim().replace(/\/$/, "");
  if (url.endsWith("/payment")) {
    url = url.slice(0, -"/payment".length);
  }
  if (url.endsWith("/v1/payment")) {
    url = url.slice(0, -"/v1/payment".length);
  }
  return url.replace(/\/$/, "");
}

/** Official Acquiring (Finik / Averspay). FINIK_API_URL is an alias for base URL. */
export function getOfficialAcquiringBaseUrl(): string {
  const fromEnv =
    process.env.FINIK_OFFICIAL_ACQUIRING_BASE_URL?.trim() ||
    process.env.FINIK_API_URL?.trim() ||
    "";
  if (fromEnv !== "") {
    return normalizeOfficialAcquiringBaseUrl(fromEnv);
  }
  return "https://beta.api.acquiring.averspay.kg";
}

export function getOfficialAcquiringCreatePath(): string {
  const p = (
    process.env.FINIK_OFFICIAL_ACQUIRING_CREATE_PATH || "/v1/payment"
  ).trim();
  return p.startsWith("/") ? p : `/${p}`;
}

/** Default status path aligned with FINIK_API_URL / create path when env unset. */
function defaultOfficialAcquiringStatusPathTemplate(): string {
  const explicitCreate = process.env.FINIK_OFFICIAL_ACQUIRING_CREATE_PATH?.trim();
  if (explicitCreate !== undefined && explicitCreate !== "") {
    if (explicitCreate.endsWith("/payment")) {
      return `${explicitCreate}/{paymentId}`;
    }
    if (explicitCreate.includes("{paymentId}")) {
      return explicitCreate;
    }
  }
  const apiUrl = process.env.FINIK_API_URL?.trim() ?? "";
  if (apiUrl.endsWith("/payment") || apiUrl.endsWith("/payment/")) {
    return "/payment/{paymentId}";
  }
  return "/v1/payment/{paymentId}";
}

function resolveOfficialAcquiringStatusPathTemplate(): string {
  const explicit = process.env.FINIK_OFFICIAL_ACQUIRING_STATUS_PATH?.trim();
  if (explicit !== undefined && explicit !== "") {
    return explicit;
  }
  return defaultOfficialAcquiringStatusPathTemplate();
}

/**
 * Official GET payment status (не описан в Telegraph; дефолт — симметрия с create).
 * Placeholder: `{paymentId}` (URL-encoded).
 */
export function getOfficialAcquiringStatusPath(paymentId: string): string {
  const template = resolveOfficialAcquiringStatusPathTemplate();
  const path = template.replace(
    "{paymentId}",
    encodeURIComponent(paymentId.trim()),
  );
  return path.startsWith("/") ? path : `/${path}`;
}

/** Fallback paths when Finik host uses `/payment` without `/v1`. */
export function listOfficialAcquiringStatusPaths(paymentId: string): string[] {
  const primary = getOfficialAcquiringStatusPath(paymentId);
  const paths = [primary];
  const alt = `/payment/${encodeURIComponent(paymentId.trim())}`;
  if (primary !== alt && !paths.includes(alt)) {
    paths.push(alt);
  }
  const v1Alt = `/v1/payment/${encodeURIComponent(paymentId.trim())}`;
  if (primary !== v1Alt && !paths.includes(v1Alt)) {
    paths.push(v1Alt);
  }
  return paths;
}

export function getOfficialAcquiringStatusUrl(paymentId: string): string {
  return `${getOfficialAcquiringBaseUrl()}${getOfficialAcquiringStatusPath(paymentId)}`;
}

export function getOfficialAcquiringCreateUrl(): string {
  return `${getOfficialAcquiringBaseUrl()}${getOfficialAcquiringCreatePath()}`;
}

/** Для `auto` / `official`: нужен PEM для RSA-SHA256. */
export function isOfficialAcquiringSigningConfigured(): boolean {
  return isFinikRsaPrivateKeyConfigured();
}

export function isOfficialAcquiringRoutingAllowed(): boolean {
  const mode = getFinikCreateApiMode();
  if (mode === "legacy") return false;
  if (mode === "official") return true;
  return isOfficialAcquiringSigningConfigured();
}
