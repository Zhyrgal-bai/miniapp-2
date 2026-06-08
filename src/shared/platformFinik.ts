import {
  finikHasAccountId,
  finikHasApiKey,
  isFinikOfficialPrivateKeyConfigured,
  isFinikUseMockEnabled,
} from "./finikReady.js";

/** @deprecated Legacy HTTP — Official Acquiring не использует shared secret. */
export type PlatformFinikCredentials = {
  apiKey: string;
  secret: string;
};

function envTrim(name: string): string {
  return process.env[name]?.trim() ?? "";
}

/** Platform API Key: PLATFORM_FINIK_API_KEY → FINIK_API_KEY. */
export function getPlatformFinikApiKey(): string {
  return envTrim("PLATFORM_FINIK_API_KEY") || envTrim("FINIK_API_KEY");
}

/** Platform Account ID: PLATFORM_FINIK_ACCOUNT_ID → FINIK_ACCOUNT_ID. */
export function getPlatformFinikAccountId(): string {
  return envTrim("PLATFORM_FINIK_ACCOUNT_ID") || envTrim("FINIK_ACCOUNT_ID");
}

/** @deprecated Legacy HTTP only — не используется subscription billing после Phase 11.4. */
export function getPlatformFinikCredentials(): PlatformFinikCredentials | null {
  const apiKey = getPlatformFinikApiKey();
  const secret = envTrim("PLATFORM_FINIK_SECRET");
  if (apiKey === "" || secret === "") {
    return null;
  }
  return { apiKey, secret };
}

export function isFinikOfficialPublicKeyConfigured(): boolean {
  return envTrim("FINIK_PUBLIC_KEY") !== "";
}

/** API Key + Account ID (Official Finik identity). */
export function isPlatformFinikReady(): boolean {
  if (isFinikUseMockEnabled()) {
    return true;
  }
  return (
    finikHasApiKey(getPlatformFinikApiKey()) &&
    finikHasAccountId(getPlatformFinikAccountId())
  );
}

/** Official RSA: API Key + Account ID + private + public PEM. */
export function isPlatformFinikOfficialReady(): boolean {
  if (isFinikUseMockEnabled()) {
    return true;
  }
  return (
    isPlatformFinikReady() &&
    isFinikOfficialPrivateKeyConfigured() &&
    isFinikOfficialPublicKeyConfigured()
  );
}

/** @deprecated Legacy HTTP create — subscription использует Official RSA. */
export function isPlatformFinikLegacyHttpReady(): boolean {
  if (isFinikUseMockEnabled()) {
    return true;
  }
  return getPlatformFinikCredentials() != null;
}

/** Alias: pay-ready = official RSA configured (Phase 11.4). */
export function isPlatformFinikPayReady(): boolean {
  return isPlatformFinikOfficialReady();
}

export const PLATFORM_FINIK_OFFICIAL_UNAVAILABLE_ERROR =
  "Онлайн-оплата Finik временно недоступна: на сервере не настроены FINIK_API_KEY, FINIK_ACCOUNT_ID, FINIK_PRIVATE_KEY и FINIK_PUBLIC_KEY.";

/** Mock create platform subscription session. */
export function platformFinikUseMockForCreate(): boolean {
  if (isFinikUseMockEnabled()) {
    return true;
  }
  return (
    !finikHasApiKey(getPlatformFinikApiKey()) ||
    !finikHasAccountId(getPlatformFinikAccountId())
  );
}
