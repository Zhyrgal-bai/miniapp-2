import {
  computeDeliveryQuote,
  defaultMerchantDeliverySettings,
  haversineDistanceKm,
  parseMerchantDeliverySettings,
  type MerchantDeliverySettings,
} from "../../../shared/merchantDeliverySettings.js";
import {
  defaultStoreAvailabilitySettings,
  etaMidMinutes,
  formatEtaRange,
  parseStoreAvailabilitySettings,
  resolveDeliveryEtaForKm,
  type StoreAvailabilitySettings,
} from "../../../shared/storeAvailabilitySettings.js";
import type {
  CheckoutDeliveryQuote,
  CheckoutDeliveryQuoteFailure,
} from "../../../shared/hybridDeliveryCheckout.js";

export type MerchantFallbackInput = {
  deliverySettingsRaw: unknown;
  storeAvailabilityRaw: unknown;
  storeLatitude: number | null;
  storeLongitude: number | null;
  customerLatitude: number;
  customerLongitude: number;
  subtotalSom: number;
};

function parseSettings(
  deliverySettingsRaw: unknown,
  storeAvailabilityRaw: unknown,
): { delivery: MerchantDeliverySettings; availability: StoreAvailabilitySettings } {
  const deliveryParsed = parseMerchantDeliverySettings(deliverySettingsRaw);
  const availParsed = parseStoreAvailabilitySettings(storeAvailabilityRaw);
  return {
    delivery: deliveryParsed.ok ? deliveryParsed.value : defaultMerchantDeliverySettings(),
    availability: availParsed.ok ? availParsed.value : defaultStoreAvailabilitySettings(),
  };
}

/** Max delivery radius in km from zones or distance tiers (last tier/zone cap). */
export function maxMerchantDeliveryRadiusKm(
  delivery: MerchantDeliverySettings,
  availability: StoreAvailabilitySettings,
): number | null {
  const zones = availability.deliveryZones;
  if (zones.length > 0) {
    const lastZone = zones[zones.length - 1];
    if (lastZone?.maxKm != null && Number.isFinite(lastZone.maxKm)) {
      return lastZone.maxKm;
    }
  }
  const tiers = delivery.distanceTiers;
  if (tiers.length > 0) {
    const lastTier = tiers[tiers.length - 1];
    if (lastTier?.maxKm != null && Number.isFinite(lastTier.maxKm)) {
      return lastTier.maxKm;
    }
  }
  return null;
}

function formatPriceSom(amount: number): string {
  return `${Math.round(amount)} сом`;
}

function buildDisplayLabel(feeSom: number, etaLabel: string | null, manual: boolean): string {
  if (manual) return "Доставка · уточняется";
  const pricePart = feeSom === 0 ? "бесплатно" : formatPriceSom(feeSom);
  if (etaLabel) return `Доставка · ${pricePart} · ${etaLabel}`;
  return `Доставка · ${pricePart}`;
}

function mapMerchantQuoteError(
  code: string,
  error: string,
): CheckoutDeliveryQuoteFailure {
  if (code === "MIN_ORDER") {
    return { ok: false, code: "MIN_ORDER", message: error };
  }
  if (code === "PICKUP_ONLY") {
    return { ok: false, code: "PICKUP_ONLY", message: error };
  }
  if (code === "DISTANCE_UNKNOWN") {
    return { ok: false, code: "DISTANCE_UNKNOWN", message: error };
  }
  if (code === "DELIVERY_DISABLED") {
    return { ok: false, code: "DELIVERY_DISABLED", message: error };
  }
  return { ok: false, code: "DELIVERY_UNAVAILABLE", message: error };
}

export function resolveMerchantDeliveryFallback(
  input: MerchantFallbackInput,
): CheckoutDeliveryQuote {
  const { delivery, availability } = parseSettings(
    input.deliverySettingsRaw,
    input.storeAvailabilityRaw,
  );

  if (!availability.deliveryEnabled && delivery.pricingMode !== "SELF_PICKUP") {
    return {
      ok: false,
      code: "DELIVERY_UNAVAILABLE",
      message: "Доставка временно недоступна.",
    };
  }

  let distanceKm: number | null = null;
  if (
    input.storeLatitude != null &&
    input.storeLongitude != null &&
    Number.isFinite(input.storeLatitude) &&
    Number.isFinite(input.storeLongitude)
  ) {
    distanceKm =
      Math.round(
        haversineDistanceKm(
          { latitude: input.storeLatitude, longitude: input.storeLongitude },
          { latitude: input.customerLatitude, longitude: input.customerLongitude },
        ) * 100,
      ) / 100;
  }

  const maxRadius = maxMerchantDeliveryRadiusKm(delivery, availability);
  if (distanceKm != null && maxRadius != null && distanceKm > maxRadius) {
    return {
      ok: false,
      code: "DELIVERY_UNAVAILABLE",
      message: "Доставка по этому адресу недоступна.",
    };
  }

  const quote = computeDeliveryQuote({
    settings: delivery,
    fulfillmentMode: "DELIVERY",
    subtotalSom: input.subtotalSom,
    distanceKm,
  });

  if (!quote.ok) {
    return mapMerchantQuoteError(quote.code, quote.error);
  }

  const etaRange = resolveDeliveryEtaForKm(availability, distanceKm);
  const etaMinutes = etaMidMinutes(etaRange);
  const etaLabel = formatEtaRange(etaRange);

  return {
    ok: true,
    provider: "merchant",
    calculationSource: "fixed",
    deliveryFeeSom: quote.deliveryFeeSom,
    etaMinutes,
    etaLabel,
    providerOfferId: null, // merchant-owned: never a marketplace provider offer
    manualConfirmation: quote.manualConfirmation,
    message: quote.message,
    displayLabel: buildDisplayLabel(
      quote.deliveryFeeSom,
      quote.manualConfirmation ? null : etaLabel,
      quote.manualConfirmation,
    ),
    distanceKm,
    fallbackUsed: true,
  };
}
