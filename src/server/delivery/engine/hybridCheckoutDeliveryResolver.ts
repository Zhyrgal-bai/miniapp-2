import { prisma } from "../../db.js";
import type { DeliveryPriceErrorCode } from "../types/deliveryPriceTypes.js";
import type {
  CheckoutDeliveryQuote,
  HybridCheckoutDeliveryInput,
} from "../../../shared/hybridDeliveryCheckout.js";
import {
  CHECKOUT_MERCHANT_ROUTE,
  CHECKOUT_UNAVAILABLE_ROUTE,
  CHECKOUT_YANDEX_ROUTE,
  resolveCheckoutDeliveryRoute,
} from "../../../shared/checkoutDeliveryRouting.js";
import { haversineDistanceKm } from "../../../shared/merchantDeliverySettings.js";
import { getDeliveryEnginePlugin } from "./ProviderRegistry.js";
import {
  createProviderPolicyResolver,
  type ProviderPolicyResolver,
} from "./ProviderPolicyResolver.js";
import {
  defaultProviderHealthService,
  type ProviderHealthService,
} from "./ProviderHealthService.js";
import { resolveMerchantDeliveryFallback } from "./merchantDeliveryFallback.js";
import { incrementDeliveryMetric } from "../utils/deliveryMetrics.js";
import { emitStructuredLog } from "../../structuredLog.js";
import "./deliveryEngineBootstrap.js";

const YANDEX_PROVIDER_ID = "yandex";

function formatPriceSom(amount: number): string {
  return `${Math.round(amount)} сом`;
}

function buildLiveDisplayLabel(price: number, etaMinutes: number | null): string {
  const pricePart = price === 0 ? "бесплатно" : formatPriceSom(price);
  if (etaMinutes != null && etaMinutes > 0) {
    return `Доставка · ${pricePart} · ${etaMinutes} мин`;
  }
  return `Доставка · ${pricePart}`;
}

function mapProviderFailure(code: DeliveryPriceErrorCode, message: string): CheckoutDeliveryQuote {
  if (code === "invalid_coordinates") {
    return { ok: false, code: "INVALID_COORDINATES", message };
  }
  if (code === "merchant_not_found") {
    return { ok: false, code: "MERCHANT_NOT_FOUND", message };
  }
  if (code === "delivery_disabled" || code === "merchant_unavailable") {
    return { ok: false, code: "DELIVERY_DISABLED", message };
  }
  return { ok: false, code: "DELIVERY_UNAVAILABLE", message };
}

function unavailableMessage(reason: string | null): string {
  switch (reason) {
    case "no_merchant_region":
      return "Доставка в этот регион недоступна.";
    case "merchant_disabled":
      return "Доставка магазином отключена.";
    case "pickup_only":
      return "Доступен только самовывоз.";
    default:
      return "Доставка по этому адресу недоступна.";
  }
}

function computeDistanceKm(
  storeLatitude: number | null,
  storeLongitude: number | null,
  customerLatitude: number,
  customerLongitude: number,
): number | null {
  if (
    storeLatitude == null ||
    storeLongitude == null ||
    !Number.isFinite(storeLatitude) ||
    !Number.isFinite(storeLongitude)
  ) {
    return null;
  }
  return (
    Math.round(
      haversineDistanceKm(
        { latitude: storeLatitude, longitude: storeLongitude },
        { latitude: customerLatitude, longitude: customerLongitude },
      ) * 100,
    ) / 100
  );
}

export type HybridCheckoutResolverDeps = {
  policyResolver?: ProviderPolicyResolver;
  healthService?: ProviderHealthService;
};

export function createHybridCheckoutDeliveryResolver(deps: HybridCheckoutResolverDeps = {}) {
  const policyResolver = deps.policyResolver ?? createProviderPolicyResolver();
  const healthService = deps.healthService ?? defaultProviderHealthService;

  async function resolveYandexQuote(
    input: HybridCheckoutDeliveryInput,
    providerOrder: string[],
  ): Promise<CheckoutDeliveryQuote> {
    const calcInput = {
      merchantId: input.merchantId,
      destination: input.destination,
      ...(input.correlationId ? { correlationId: input.correlationId } : {}),
      ...(input.requestId ? { requestId: input.requestId } : {}),
    };

    const yandexCandidates = providerOrder.filter((id) => id === YANDEX_PROVIDER_ID);
    const providersToTry =
      yandexCandidates.length > 0 ? yandexCandidates : [YANDEX_PROVIDER_ID];

    let lastFailureMessage = "Доставка по этому адресу недоступна.";

    for (const providerId of providersToTry) {
      const plugin = getDeliveryEnginePlugin(providerId);
      if (!plugin?.capabilities.calculatePrice || !plugin.calculatePrice) continue;

      const started = Date.now();
      const result = await plugin.calculatePrice(calcInput);
      const durationMs = Date.now() - started;

      if (result.ok) {
        healthService.record(providerId, { type: "success", responseTimeMs: durationMs });
        incrementDeliveryMetric("checkout_delivery_live_total");
        incrementDeliveryMetric("checkout_delivery_provider_selected");

        const quote = {
          ok: true as const,
          provider: result.quote.provider,
          calculationSource: "live" as const,
          deliveryFeeSom: result.quote.price,
          etaMinutes: result.quote.etaMinutes,
          etaLabel:
            result.quote.etaMinutes != null ? `${result.quote.etaMinutes} мин` : null,
          providerOfferId: result.quote.providerOfferId,
          manualConfirmation: false,
          message: null,
          displayLabel: buildLiveDisplayLabel(
            result.quote.price,
            result.quote.etaMinutes,
          ),
          distanceKm: null,
          fallbackUsed: false,
        };

        emitStructuredLog("info", "checkout_delivery_resolved", {
          merchantId: input.merchantId,
          provider: result.quote.provider,
          source: "live",
          route: CHECKOUT_YANDEX_ROUTE,
          fallbackUsed: false,
        });

        return quote;
      }

      if (result.code === "provider_timeout") {
        healthService.record(providerId, { type: "timeout" });
      } else if (result.code === "provider_rate_limit") {
        healthService.record(providerId, { type: "rate_limit" });
      } else if (result.code === "provider_unavailable") {
        healthService.record(providerId, { type: "server_error" });
      } else {
        healthService.record(providerId, { type: "failure" });
      }

      lastFailureMessage = result.message;

      if (
        result.code === "invalid_coordinates" ||
        result.code === "merchant_not_found" ||
        result.code === "delivery_disabled" ||
        result.code === "merchant_unavailable"
      ) {
        return mapProviderFailure(result.code, result.message);
      }
    }

    incrementDeliveryMetric("checkout_delivery_unavailable_total");
    emitStructuredLog("info", "checkout_delivery_resolved", {
      merchantId: input.merchantId,
      provider: null,
      source: null,
      route: CHECKOUT_YANDEX_ROUTE,
      fallbackUsed: false,
      unavailable: true,
    });

    return {
      ok: false,
      code: "DELIVERY_UNAVAILABLE",
      message: lastFailureMessage,
    };
  }

  async function resolveHybridCheckoutDelivery(
    input: HybridCheckoutDeliveryInput,
  ): Promise<CheckoutDeliveryQuote> {
    if (input.fulfillmentMode === "PICKUP") {
      return {
        ok: true,
        provider: null,
        calculationSource: null,
        deliveryFeeSom: 0,
        etaMinutes: null,
        etaLabel: null,
        providerOfferId: null,
        manualConfirmation: false,
        message: null,
        displayLabel: "Самовывоз",
        distanceKm: null,
        fallbackUsed: false,
      };
    }

    const business = await prisma.business.findUnique({
      where: { id: input.merchantId },
      select: {
        deliverySettings: true,
        storeAvailabilitySettings: true,
        latitude: true,
        longitude: true,
      },
    });

    if (!business) {
      return {
        ok: false,
        code: "MERCHANT_NOT_FOUND",
        message: "Магазин не найден.",
      };
    }

    const distanceKm = computeDistanceKm(
      business.latitude,
      business.longitude,
      input.destination.latitude,
      input.destination.longitude,
    );

    const routeResult = resolveCheckoutDeliveryRoute({
      deliverySettingsRaw: business.deliverySettings,
      destinationLocality: input.destinationLocality ?? null,
      destinationLabel: input.destinationLabel ?? null,
      distanceKm,
    });

    if (routeResult.route === CHECKOUT_UNAVAILABLE_ROUTE) {
      incrementDeliveryMetric("checkout_delivery_unavailable_total");
      emitStructuredLog("info", "checkout_delivery_resolved", {
        merchantId: input.merchantId,
        provider: null,
        source: null,
        route: CHECKOUT_UNAVAILABLE_ROUTE,
        routeReason: routeResult.reason,
        fallbackUsed: false,
        unavailable: true,
      });
      return {
        ok: false,
        code: "DELIVERY_UNAVAILABLE",
        message: unavailableMessage(routeResult.reason),
      };
    }

    if (routeResult.route === CHECKOUT_MERCHANT_ROUTE) {
      const merchantResult = resolveMerchantDeliveryFallback({
        deliverySettingsRaw: business.deliverySettings,
        storeAvailabilityRaw: business.storeAvailabilitySettings,
        storeLatitude: business.latitude,
        storeLongitude: business.longitude,
        customerLatitude: input.destination.latitude,
        customerLongitude: input.destination.longitude,
        subtotalSom: input.subtotalSom,
        destinationLabel: input.destinationLabel ?? null,
        destinationLocality: input.destinationLocality ?? null,
      });

      if (merchantResult.ok) {
        incrementDeliveryMetric("checkout_delivery_merchant_fallback_total");
        incrementDeliveryMetric("checkout_delivery_provider_selected");
        emitStructuredLog("info", "checkout_delivery_resolved", {
          merchantId: input.merchantId,
          provider: "merchant",
          source: "fixed",
          route: CHECKOUT_MERCHANT_ROUTE,
          routeReason: routeResult.reason,
          matchedRegionId: routeResult.matchedRegionId,
          fallbackUsed: false,
        });
        return { ...merchantResult, fallbackUsed: false };
      }

      incrementDeliveryMetric("checkout_delivery_unavailable_total");
      emitStructuredLog("info", "checkout_delivery_resolved", {
        merchantId: input.merchantId,
        provider: null,
        source: null,
        route: CHECKOUT_MERCHANT_ROUTE,
        routeReason: routeResult.reason,
        fallbackUsed: false,
        unavailable: true,
      });

      if (
        merchantResult.code === "MIN_ORDER" ||
        merchantResult.code === "DISTANCE_UNKNOWN" ||
        merchantResult.code === "PICKUP_ONLY" ||
        merchantResult.code === "DELIVERY_DISABLED"
      ) {
        return merchantResult;
      }

      return {
        ok: false,
        code: "DELIVERY_UNAVAILABLE",
        message: merchantResult.message,
      };
    }

    const providerOrder = await policyResolver.resolveProviderOrder(input.merchantId);
    return resolveYandexQuote(input, providerOrder);
  }

  return { resolveHybridCheckoutDelivery };
}

const defaultResolver = createHybridCheckoutDeliveryResolver();

export async function resolveHybridCheckoutDelivery(
  input: HybridCheckoutDeliveryInput,
): Promise<CheckoutDeliveryQuote> {
  return defaultResolver.resolveHybridCheckoutDelivery(input);
}
