/** Phase 8.5 — unified checkout delivery quote (engine + merchant fallback). */

/**
 * Merchant-configured delivery (zones/tiers). Not a marketplace provider delivery.
 *
 * Business rule: fee is included in a single Finik payment to the merchant account.
 * ARCHA does not receive, hold, or split the merchant delivery fee.
 * No ProviderDelivery row, no provider claim, deliveryOfferId stays null.
 */
export const MERCHANT_OWNED_DELIVERY_PROVIDER = "merchant" as const;

export type MerchantOwnedDeliveryProvider = typeof MERCHANT_OWNED_DELIVERY_PROVIDER;

export function isMerchantOwnedDelivery(
  deliveryProvider: string | null | undefined,
): boolean {
  return deliveryProvider === MERCHANT_OWNED_DELIVERY_PROVIDER;
}

/** True when paid-order provider fulfillment (claims, ProviderDelivery) may run. */
export function requiresProviderDeliveryFulfillment(input: {
  deliveryMode: "DELIVERY" | "PICKUP";
  deliveryProvider: string | null | undefined;
  deliveryOfferId: string | null | undefined;
}): boolean {
  if (input.deliveryMode !== "DELIVERY") return false;
  if (isMerchantOwnedDelivery(input.deliveryProvider)) return false;
  return (input.deliveryOfferId?.trim() ?? "") !== "";
}

export type CheckoutFulfillmentMode = "DELIVERY" | "PICKUP";

export type CheckoutDeliveryCalculationSource = "live" | "fixed";

export type CheckoutDeliveryQuoteErrorCode =
  | "DELIVERY_UNAVAILABLE"
  | "MIN_ORDER"
  | "PICKUP_ONLY"
  | "DISTANCE_UNKNOWN"
  | "INVALID_COORDINATES"
  | "DELIVERY_DISABLED"
  | "INVALID_SETTINGS"
  | "MERCHANT_NOT_FOUND";

export type CheckoutDeliveryQuoteSuccess = {
  ok: true;
  provider: string | null;
  calculationSource: CheckoutDeliveryCalculationSource | null;
  deliveryFeeSom: number;
  etaMinutes: number | null;
  etaLabel: string | null;
  providerOfferId: string | null;
  manualConfirmation: boolean;
  message: string | null;
  displayLabel: string;
  distanceKm: number | null;
  fallbackUsed: boolean;
};

export type CheckoutDeliveryQuoteFailure = {
  ok: false;
  code: CheckoutDeliveryQuoteErrorCode;
  message: string;
};

export type CheckoutDeliveryQuote = CheckoutDeliveryQuoteSuccess | CheckoutDeliveryQuoteFailure;

import type { DeliveryDestinationLocality } from "./merchantDeliveryLocality.js";

export type { DeliveryDestinationLocality } from "./merchantDeliveryLocality.js";

export type HybridCheckoutDeliveryInput = {
  merchantId: number;
  destination: { latitude: number; longitude: number };
  subtotalSom: number;
  fulfillmentMode: CheckoutFulfillmentMode;
  /** @deprecated Phase 9.1 — substring fallback only; prefer destinationLocality. */
  destinationLabel?: string | null;
  destinationLocality?: DeliveryDestinationLocality | null;
  correlationId?: string;
  requestId?: string;
};

export const CHECKOUT_DELIVERY_QUOTE_HTTP_STATUS: Record<CheckoutDeliveryQuoteErrorCode, number> = {
  DELIVERY_UNAVAILABLE: 409,
  MIN_ORDER: 400,
  PICKUP_ONLY: 400,
  DISTANCE_UNKNOWN: 400,
  INVALID_COORDINATES: 400,
  DELIVERY_DISABLED: 403,
  INVALID_SETTINGS: 400,
  MERCHANT_NOT_FOUND: 404,
};
