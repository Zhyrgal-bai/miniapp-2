import {
  finikHasAccountId,
  finikHasApiKey,
  isFinikUseMockEnabled,
} from "./finikReady.js";

export type PlatformFinikCredentials = {
  apiKey: string;
  secret: string;
};

/** API Key платформы (оплата SaaS-подписки). */
export function getPlatformFinikApiKey(): string {
  return process.env.PLATFORM_FINIK_API_KEY?.trim() ?? "";
}

/** Account ID платформы в Finik. */
export function getPlatformFinikAccountId(): string {
  return process.env.PLATFORM_FINIK_ACCOUNT_ID?.trim() ?? "";
}

/** Ключи Finik платформы для legacy HTTP (create + HMAC webhook). */
export function getPlatformFinikCredentials(): PlatformFinikCredentials | null {
  const apiKey = getPlatformFinikApiKey();
  const secret = process.env.PLATFORM_FINIK_SECRET?.trim() ?? "";
  if (apiKey === "" || secret === "") {
    return null;
  }
  return { apiKey, secret };
}

/** Готовность платформы: API Key + Account ID (официальная модель Finik). */
export function isPlatformFinikReady(): boolean {
  if (isFinikUseMockEnabled()) {
    return true;
  }
  return (
    finikHasApiKey(getPlatformFinikApiKey()) &&
    finikHasAccountId(getPlatformFinikAccountId())
  );
}

/** Legacy HTTP create платформы (до Phase 3). */
export function isPlatformFinikLegacyHttpReady(): boolean {
  if (isFinikUseMockEnabled()) {
    return true;
  }
  return getPlatformFinikCredentials() != null;
}

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
