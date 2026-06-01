/** Единый критерий готовности Finik для заказов, вебхуков и кабинета мерчанта. */

export const FINIK_LEGACY_HTTP_UNAVAILABLE_ERROR =
  "Онлайн-оплата Finik временно недоступна: требуется завершение настройки на сервере. Обратитесь в поддержку.";

export function isFinikUseMockEnabled(): boolean {
  const v = process.env.FINIK_USE_MOCK;
  return v === "1" || v === "true";
}

/** Готовность по официальной модели Finik: API Key + Account ID. */
export function isFinikCredentialsReady(
  finikApiKey: string | null | undefined,
  finikAccountId: string | null | undefined,
): boolean {
  if (isFinikUseMockEnabled()) {
    return true;
  }
  return finikHasApiKey(finikApiKey) && finikHasAccountId(finikAccountId);
}

/** Legacy HTTP create/webhook (до Phase 3): API Key + Secret. */
export function isFinikLegacyHttpReady(
  finikApiKey: string | null | undefined,
  finikSecret: string | null | undefined,
): boolean {
  if (isFinikUseMockEnabled()) {
    return true;
  }
  return finikHasApiKey(finikApiKey) && finikHasSecret(finikSecret);
}

export function finikHasApiKey(finikApiKey: string | null | undefined): boolean {
  return typeof finikApiKey === "string" && finikApiKey.trim().length > 0;
}

export function finikHasAccountId(
  finikAccountId: string | null | undefined,
): boolean {
  return typeof finikAccountId === "string" && finikAccountId.trim().length > 0;
}

export function finikHasSecret(finikSecret: string | null | undefined): boolean {
  return typeof finikSecret === "string" && finikSecret.trim().length > 0;
}

/** Mock create session: нет mock env, API Key или Account ID. */
export function finikUseMockForBusiness(business: {
  finikApiKey: string | null | undefined;
  finikAccountId: string | null | undefined;
}): boolean {
  return (
    isFinikUseMockEnabled() ||
    !finikHasApiKey(business.finikApiKey) ||
    !finikHasAccountId(business.finikAccountId)
  );
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
