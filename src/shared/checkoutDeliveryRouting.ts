import {
  defaultMerchantDeliverySettings,
  migrateMerchantDeliverySettings,
  parseMerchantDeliverySettings,
  type MerchantDeliveryPricingMode,
  type MerchantDeliveryRegion,
} from "./merchantDeliverySettings.js";
import { isLegacyDeliveryPricingMode } from "./merchantDeliveryMigration.js";
import {
  parseCityFromDisplayAddress,
  resolveMerchantDeliveryRegionWithMeta,
  isBishkekCityName,
  type DeliveryDestinationLocality,
} from "./merchantDeliveryLocality.js";

export { isBishkekCityName } from "./merchantDeliveryLocality.js";

/**
 * Detect Bishkek destination from structured locality and/or free-text label.
 * Label substring kept for backward compatibility with legacy checkout clients.
 */
export function isBishkekDestination(
  locality?: DeliveryDestinationLocality | null,
  destinationLabel?: string | null,
): boolean {
  const loc = locality ?? {};
  if (isBishkekCityName(loc.city)) return true;

  const parsedCity = parseCityFromDisplayAddress(destinationLabel);
  if (isBishkekCityName(parsedCity)) return true;

  const label = (destinationLabel ?? "").trim().toLowerCase();
  if (label.length === 0) return false;
  return label.includes("бишкек") || label.includes("bishkek");
}

/** Live marketplace delivery (Yandex) — Bishkek only. */
export const CHECKOUT_YANDEX_ROUTE = "yandex" as const;

/** Merchant-owned regional / legacy pricing — outside Bishkek. */
export const CHECKOUT_MERCHANT_ROUTE = "merchant" as const;

export const CHECKOUT_UNAVAILABLE_ROUTE = "unavailable" as const;

export type CheckoutDeliveryRoute =
  | typeof CHECKOUT_YANDEX_ROUTE
  | typeof CHECKOUT_MERCHANT_ROUTE
  | typeof CHECKOUT_UNAVAILABLE_ROUTE;

export type CheckoutDeliveryRouteReason =
  | "bishkek_yandex"
  | "merchant_region"
  | "legacy_merchant"
  | "merchant_disabled"
  | "pickup_only"
  | "no_merchant_region";

export type CheckoutDeliveryRouteResult = {
  route: CheckoutDeliveryRoute;
  matchedRegionId: string | null;
  reason: CheckoutDeliveryRouteReason | null;
};

function merchantRegionsExcludingBishkek(
  regions: MerchantDeliveryRegion[],
): MerchantDeliveryRegion[] {
  return regions.filter((r) => !isBishkekCityName(r.name));
}

function readRawPricingMode(raw: unknown): MerchantDeliveryPricingMode | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const mode = String((raw as { pricingMode?: unknown }).pricingMode ?? "")
    .trim()
    .toUpperCase();
  if (mode === "SELF_PICKUP") return "SELF_PICKUP";
  if (mode === "FIXED_PRICE") return "FIXED_PRICE";
  if (mode === "DISTANCE_BASED") return "DISTANCE_BASED";
  if (mode === "FREE_DELIVERY") return "FREE_DELIVERY";
  if (mode === "MANUAL_CONFIRMATION") return "MANUAL_CONFIRMATION";
  if (mode === "REGION_BASED") return "REGION_BASED";
  return null;
}

/**
 * Region-based provider selection (Phase 9.2):
 * - Bishkek → Yandex only
 * - Other configured merchant regions → Merchant pricing
 * - No match → unavailable (no Yandex fallback outside Bishkek)
 */
export function resolveCheckoutDeliveryRoute(input: {
  deliverySettingsRaw: unknown;
  destinationLocality?: DeliveryDestinationLocality | null;
  destinationLabel?: string | null;
  distanceKm?: number | null;
}): CheckoutDeliveryRouteResult {
  if (isBishkekDestination(input.destinationLocality, input.destinationLabel)) {
    return {
      route: CHECKOUT_YANDEX_ROUTE,
      matchedRegionId: null,
      reason: "bishkek_yandex",
    };
  }

  const parsed = parseMerchantDeliverySettings(input.deliverySettingsRaw);
  const rawPricingMode =
    readRawPricingMode(input.deliverySettingsRaw) ??
    (parsed.ok ? parsed.value.pricingMode : defaultMerchantDeliverySettings().pricingMode);

  if (
    isLegacyDeliveryPricingMode(rawPricingMode) &&
    rawPricingMode !== "SELF_PICKUP"
  ) {
    return {
      route: CHECKOUT_MERCHANT_ROUTE,
      matchedRegionId: null,
      reason: "legacy_merchant",
    };
  }

  const settings = parsed.ok
    ? parsed.value
    : migrateMerchantDeliverySettings(defaultMerchantDeliverySettings());

  if (settings.pricingMode === "SELF_PICKUP") {
    return {
      route: CHECKOUT_UNAVAILABLE_ROUTE,
      matchedRegionId: null,
      reason: "pickup_only",
    };
  }

  if (settings.pricingMode === "REGION_BASED") {
    if (!settings.merchantDeliveryEnabled) {
      return {
        route: CHECKOUT_UNAVAILABLE_ROUTE,
        matchedRegionId: null,
        reason: "merchant_disabled",
      };
    }

    const { region } = resolveMerchantDeliveryRegionWithMeta(
      merchantRegionsExcludingBishkek(settings.regions),
      {
        locality: input.destinationLocality ?? null,
        destinationLabel: input.destinationLabel ?? null,
        distanceKm: input.distanceKm ?? null,
      },
      {
        allowDistanceTierMatch: false,
        allowSingleRegionFallback: false,
      },
    );

    if (!region) {
      return {
        route: CHECKOUT_UNAVAILABLE_ROUTE,
        matchedRegionId: null,
        reason: "no_merchant_region",
      };
    }

    return {
      route: CHECKOUT_MERCHANT_ROUTE,
      matchedRegionId: region.id,
      reason: "merchant_region",
    };
  }

  return {
    route: CHECKOUT_MERCHANT_ROUTE,
    matchedRegionId: null,
    reason: "legacy_merchant",
  };
}
