export type DeliveryPriceProvider = string;

export type DeliveryPriceErrorCode =
  | "merchant_not_found"
  | "merchant_unavailable"
  | "delivery_disabled"
  | "invalid_coordinates"
  | "provider_timeout"
  | "provider_rate_limit"
  | "provider_unavailable"
  | "tariff_unavailable"
  | "unknown_provider_error";

export type DeliveryPriceCalculateInput = {
  merchantId: number;
  destination: { latitude: number; longitude: number };
  weightKg?: number;
  correlationId?: string;
  requestId?: string;
};

export type DeliveryPriceQuoteAvailable = {
  provider: DeliveryPriceProvider;
  available: true;
  price: number;
  currency: string;
  etaMinutes: number | null;
  providerOfferId: string;
  expiresAt: string | null;
};

export type DeliveryPriceSuccess = {
  ok: true;
  quote: DeliveryPriceQuoteAvailable;
};

export type DeliveryPriceFailure = {
  ok: false;
  code: DeliveryPriceErrorCode;
  message: string;
};

export type DeliveryPriceResult = DeliveryPriceSuccess | DeliveryPriceFailure;

export const DELIVERY_PRICE_HTTP_STATUS: Record<DeliveryPriceErrorCode, number> = {
  merchant_not_found: 404,
  merchant_unavailable: 403,
  delivery_disabled: 403,
  invalid_coordinates: 400,
  provider_timeout: 504,
  provider_rate_limit: 429,
  provider_unavailable: 502,
  tariff_unavailable: 409,
  unknown_provider_error: 502,
};
