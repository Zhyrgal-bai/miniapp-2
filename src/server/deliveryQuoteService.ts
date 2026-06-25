import type { DeliveryMode } from "@prisma/client";
import {
  computeDeliveryQuote,
  defaultMerchantDeliverySettings,
  parseMerchantDeliverySettings,
  type MerchantDeliverySettings,
} from "../shared/merchantDeliverySettings.js";
import { haversineDistanceKm } from "../shared/merchantDeliverySettings.js";

export function parseBusinessDeliverySettings(raw: unknown): MerchantDeliverySettings {
  const parsed = parseMerchantDeliverySettings(raw);
  return parsed.ok ? parsed.value : defaultMerchantDeliverySettings();
}

/**
 * @deprecated Use `resolveHybridCheckoutDelivery` from the Delivery Engine.
 */
export function resolveCheckoutDeliveryQuote(input: {
  deliverySettingsRaw: unknown;
  storeLatitude: number | null;
  storeLongitude: number | null;
  customerLatitude: number | null;
  customerLongitude: number | null;
  fulfillmentMode: DeliveryMode;
  subtotalSom: number;
}):
  | { ok: true; quote: ReturnType<typeof computeDeliveryQuote> & { ok: true }; settings: MerchantDeliverySettings }
  | { ok: false; error: string; statusCode: number } {
  const settings = parseBusinessDeliverySettings(input.deliverySettingsRaw);

  let distanceKm: number | null = null;
  if (
    input.storeLatitude != null &&
    input.storeLongitude != null &&
    input.customerLatitude != null &&
    input.customerLongitude != null &&
    Number.isFinite(input.storeLatitude) &&
    Number.isFinite(input.storeLongitude) &&
    Number.isFinite(input.customerLatitude) &&
    Number.isFinite(input.customerLongitude)
  ) {
    distanceKm =
      Math.round(
        haversineDistanceKm(
          { latitude: input.storeLatitude, longitude: input.storeLongitude },
          { latitude: input.customerLatitude, longitude: input.customerLongitude },
        ) * 100,
      ) / 100;
  }

  const fulfillmentMode =
    input.fulfillmentMode === "PICKUP" ? "PICKUP" : "DELIVERY";

  const quote = computeDeliveryQuote({
    settings,
    fulfillmentMode,
    subtotalSom: input.subtotalSom,
    distanceKm,
  });

  if (!quote.ok) {
    const statusCode =
      quote.code === "MIN_ORDER" || quote.code === "PICKUP_ONLY" || quote.code === "DISTANCE_UNKNOWN"
        ? 400
        : 400;
    return { ok: false, error: quote.error, statusCode };
  }

  return { ok: true, quote, settings };
}
