import type { FinikCreateApiMode } from "./finikCreateTypes.js";

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
    process.env.FINIK_OFFICIAL_ACQUIRING_CREATE_PATH || "/payment"
  ).trim();
  return p.startsWith("/") ? p : `/${p}`;
}

export function getOfficialAcquiringCreateUrl(): string {
  return `${getOfficialAcquiringBaseUrl()}${getOfficialAcquiringCreatePath()}`;
}

/** Для `auto`: official только если задан ключ подписи (реализация — позже). */
export function isOfficialAcquiringSigningConfigured(): boolean {
  const inline = process.env.FINIK_RSA_PRIVATE_KEY?.trim() ?? "";
  const path = process.env.FINIK_RSA_PRIVATE_KEY_PATH?.trim() ?? "";
  return inline !== "" || path !== "";
}

export function isOfficialAcquiringRoutingAllowed(): boolean {
  const mode = getFinikCreateApiMode();
  if (mode === "legacy") return false;
  if (mode === "official") return true;
  return isOfficialAcquiringSigningConfigured();
}
