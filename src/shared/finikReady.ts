/** Единый критерий готовности Finik для заказов, вебхуков и кабинета мерчанта. */

export function isFinikUseMockEnabled(): boolean {
  const v = process.env.FINIK_USE_MOCK;
  return v === "1" || v === "true";
}

export function isFinikCredentialsReady(
  finikApiKey: string | null | undefined,
  finikSecret: string | null | undefined,
): boolean {
  if (isFinikUseMockEnabled()) {
    return true;
  }
  const k = typeof finikApiKey === "string" ? finikApiKey.trim() : "";
  const s = typeof finikSecret === "string" ? finikSecret.trim() : "";
  return k.length > 0 && s.length > 0;
}

export function finikHasApiKey(finikApiKey: string | null | undefined): boolean {
  return typeof finikApiKey === "string" && finikApiKey.trim().length > 0;
}

export function finikHasSecret(finikSecret: string | null | undefined): boolean {
  return typeof finikSecret === "string" && finikSecret.trim().length > 0;
}

export function buildFinikWebhookUrl(
  apiOrigin: string,
  businessId: number,
): string | null {
  const origin = apiOrigin.trim().replace(/\/$/, "");
  if (!origin || !Number.isInteger(businessId) || businessId <= 0) {
    return null;
  }
  return `${origin}/finik/webhook/${businessId}`;
}
