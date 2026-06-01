import { isFinikUseMockEnabled } from "./finikReady.js";

export type PlatformFinikCredentials = {
  apiKey: string;
  secret: string;
};

/** Ключи Finik платформы (оплата SaaS-подписки), не магазина. */
export function getPlatformFinikCredentials(): PlatformFinikCredentials | null {
  const apiKey = process.env.PLATFORM_FINIK_API_KEY?.trim() ?? "";
  const secret = process.env.PLATFORM_FINIK_SECRET?.trim() ?? "";
  if (apiKey === "" || secret === "") {
    return null;
  }
  return { apiKey, secret };
}

export function isPlatformFinikReady(): boolean {
  if (isFinikUseMockEnabled()) {
    return true;
  }
  return getPlatformFinikCredentials() != null;
}
