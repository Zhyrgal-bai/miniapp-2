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

/** Official Acquiring beta (Finik / Averspay). */
export function getOfficialAcquiringBaseUrl(): string {
  return (
    process.env.FINIK_OFFICIAL_ACQUIRING_BASE_URL ||
    "https://beta.api.acquiring.averspay.kg"
  )
    .trim()
    .replace(/\/$/, "");
}

export function getOfficialAcquiringCreatePath(): string {
  const p = (
    process.env.FINIK_OFFICIAL_ACQUIRING_CREATE_PATH || "/v1/payment"
  ).trim();
  return p.startsWith("/") ? p : `/${p}`;
}

/**
 * Official GET payment status (не описан в Telegraph; дефолт — симметрия с create).
 * Placeholder: `{paymentId}` (URL-encoded).
 */
export function getOfficialAcquiringStatusPath(paymentId: string): string {
  const template = (
    process.env.FINIK_OFFICIAL_ACQUIRING_STATUS_PATH ||
    "/v1/payment/{paymentId}"
  ).trim();
  const path = template.replace(
    "{paymentId}",
    encodeURIComponent(paymentId.trim()),
  );
  return path.startsWith("/") ? path : `/${path}`;
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
