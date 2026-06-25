const DEFAULT_API_BASE = "https://b2b.taxi.yandex.net";
const DEFAULT_OFFERS_PATH = "/b2b/cargo/integration/v2/offers/calculate";
const DEFAULT_CLAIMS_CREATE_PATH = "/b2b/cargo/integration/v2/claims/create";
const DEFAULT_CLAIMS_ACCEPT_PATH = "/b2b/cargo/integration/v2/claims/accept";
const DEFAULT_CLAIMS_INFO_PATH = "/b2b/cargo/integration/v2/claims/info";
const DEFAULT_OFFER_CACHE_TTL_MS = 1_800_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_MS = 500;

function envTrim(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function envPositiveInt(name: string, fallback: number, max?: number): number {
  const raw = envTrim(name);
  if (raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  const rounded = Math.floor(n);
  if (max != null) return Math.min(rounded, max);
  return rounded;
}

export type YandexDeliveryConfig = Readonly<{
  apiBaseUrl: string;
  offersPath: string;
  claimsCreatePath: string;
  claimsAcceptPath: string;
  claimsInfoPath: string;
  webhookBaseUrl: string;
  webhookSecret: string;
  oauthToken: string;
  useMock: boolean;
  claimsEnabled: boolean;
  offerCacheTtlMs: number;
  timeoutMs: number;
  maxRetries: number;
  retryBaseMs: number;
  configured: boolean;
}>;

export function getYandexDeliveryApiBaseUrl(): string {
  const raw =
    envTrim("YANDEX_DELIVERY_API_BASE") ||
    envTrim("YANDEX_DELIVERY_API_BASE_URL") ||
    DEFAULT_API_BASE;
  return raw.replace(/\/$/, "");
}

export function getYandexDeliveryOffersPath(): string {
  const p = envTrim("YANDEX_DELIVERY_OFFERS_PATH") || DEFAULT_OFFERS_PATH;
  return p.startsWith("/") ? p : `/${p}`;
}

export function getYandexDeliveryClaimsCreatePath(): string {
  const p = envTrim("YANDEX_DELIVERY_CLAIMS_CREATE_PATH") || DEFAULT_CLAIMS_CREATE_PATH;
  return p.startsWith("/") ? p : `/${p}`;
}

export function getYandexDeliveryClaimsAcceptPath(): string {
  const p = envTrim("YANDEX_DELIVERY_CLAIMS_ACCEPT_PATH") || DEFAULT_CLAIMS_ACCEPT_PATH;
  return p.startsWith("/") ? p : `/${p}`;
}

export function getYandexDeliveryClaimsInfoPath(): string {
  const p = envTrim("YANDEX_DELIVERY_CLAIMS_INFO_PATH") || DEFAULT_CLAIMS_INFO_PATH;
  return p.startsWith("/") ? p : `/${p}`;
}

export function getYandexDeliveryWebhookBaseUrl(): string {
  return envTrim("YANDEX_DELIVERY_WEBHOOK_BASE_URL");
}

export function getYandexDeliveryWebhookSecret(): string {
  return envTrim("YANDEX_DELIVERY_WEBHOOK_SECRET");
}

export function isYandexDeliveryClaimsEnabled(): boolean {
  const v = envTrim("YANDEX_DELIVERY_CLAIMS_ENABLED");
  return v === "1" || v === "true" || v === "on";
}

export function getYandexDeliveryOfferCacheTtlMs(): number {
  return envPositiveInt(
    "YANDEX_DELIVERY_OFFER_CACHE_TTL_MS",
    DEFAULT_OFFER_CACHE_TTL_MS,
    3_600_000,
  );
}

export function getYandexDeliveryOffersUrl(): string {
  return `${getYandexDeliveryApiBaseUrl()}${getYandexDeliveryOffersPath()}`;
}

export function getYandexDeliveryOAuthToken(): string {
  return (
    envTrim("YANDEX_DELIVERY_OAUTH_TOKEN") ||
    envTrim("YANDEX_DELIVERY_API_TOKEN") ||
    envTrim("YANDEX_DELIVERY_TOKEN")
  );
}

export function isYandexDeliveryMockEnabled(): boolean {
  const v = envTrim("YANDEX_DELIVERY_USE_MOCK");
  return v === "1" || v === "true" || v === "on";
}

export function isYandexDeliveryConfigured(): boolean {
  if (isYandexDeliveryMockEnabled()) return true;
  return getYandexDeliveryOAuthToken() !== "";
}

export function getYandexDeliveryRequestTimeoutMs(): number {
  return envPositiveInt("YANDEX_DELIVERY_TIMEOUT_MS", DEFAULT_TIMEOUT_MS, 60_000);
}

export function getYandexDeliveryHttpMaxRetries(): number {
  return envPositiveInt("YANDEX_DELIVERY_HTTP_MAX_RETRIES", DEFAULT_MAX_RETRIES, 5);
}

export function getYandexDeliveryHttpRetryBaseMs(): number {
  return envPositiveInt("YANDEX_DELIVERY_HTTP_RETRY_BASE_MS", DEFAULT_RETRY_BASE_MS, 5_000);
}

/** Frozen snapshot of Yandex Delivery env configuration. */
export function loadYandexDeliveryConfig(): YandexDeliveryConfig {
  const useMock = isYandexDeliveryMockEnabled();
  const oauthToken = getYandexDeliveryOAuthToken();
  return Object.freeze({
    apiBaseUrl: getYandexDeliveryApiBaseUrl(),
    offersPath: getYandexDeliveryOffersPath(),
    claimsCreatePath: getYandexDeliveryClaimsCreatePath(),
    claimsAcceptPath: getYandexDeliveryClaimsAcceptPath(),
    claimsInfoPath: getYandexDeliveryClaimsInfoPath(),
    webhookBaseUrl: getYandexDeliveryWebhookBaseUrl(),
    webhookSecret: getYandexDeliveryWebhookSecret(),
    oauthToken,
    useMock,
    claimsEnabled: isYandexDeliveryClaimsEnabled(),
    offerCacheTtlMs: getYandexDeliveryOfferCacheTtlMs(),
    timeoutMs: getYandexDeliveryRequestTimeoutMs(),
    maxRetries: getYandexDeliveryHttpMaxRetries(),
    retryBaseMs: getYandexDeliveryHttpRetryBaseMs(),
    configured: useMock || oauthToken !== "",
  });
}
