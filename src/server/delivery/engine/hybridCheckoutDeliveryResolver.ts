import { prisma } from "../../db.js";
import type { DeliveryPriceErrorCode } from "../types/deliveryPriceTypes.js";
import type {
  CheckoutDeliveryQuote,
  HybridCheckoutDeliveryInput,
} from "../../../shared/hybridDeliveryCheckout.js";
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

const FALLBACK_ELIGIBLE_CODES: DeliveryPriceErrorCode[] = [
  "tariff_unavailable",
  "provider_unavailable",
  "provider_timeout",
  "provider_rate_limit",
  "unknown_provider_error",
];

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

export type HybridCheckoutResolverDeps = {
  policyResolver?: ProviderPolicyResolver;
  healthService?: ProviderHealthService;
};

export function createHybridCheckoutDeliveryResolver(deps: HybridCheckoutResolverDeps = {}) {
  const policyResolver = deps.policyResolver ?? createProviderPolicyResolver();
  const healthService = deps.healthService ?? defaultProviderHealthService;

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

    const calcInput = {
      merchantId: input.merchantId,
      destination: input.destination,
      ...(input.correlationId ? { correlationId: input.correlationId } : {}),
      ...(input.requestId ? { requestId: input.requestId } : {}),
    };

    const providerOrder = await policyResolver.resolveProviderOrder(input.merchantId);
    let hadFallbackEligibleFailure = false;
    let lastFailureMessage = "Доставка по этому адресу недоступна.";

    for (const providerId of providerOrder) {
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

      if (FALLBACK_ELIGIBLE_CODES.includes(result.code)) {
        hadFallbackEligibleFailure = true;
        continue;
      }

      return mapProviderFailure(result.code, result.message);
    }

    if (!hadFallbackEligibleFailure && providerOrder.length > 0) {
      incrementDeliveryMetric("checkout_delivery_unavailable_total");
      emitStructuredLog("info", "checkout_delivery_resolved", {
        merchantId: input.merchantId,
        provider: null,
        source: null,
        fallbackUsed: false,
        unavailable: true,
      });
      return {
        ok: false,
        code: "DELIVERY_UNAVAILABLE",
        message: lastFailureMessage,
      };
    }

    const merchantResult = resolveMerchantDeliveryFallback({
      deliverySettingsRaw: business.deliverySettings,
      storeAvailabilityRaw: business.storeAvailabilitySettings,
      storeLatitude: business.latitude,
      storeLongitude: business.longitude,
      customerLatitude: input.destination.latitude,
      customerLongitude: input.destination.longitude,
      subtotalSom: input.subtotalSom,
    });

    if (merchantResult.ok) {
      incrementDeliveryMetric("checkout_delivery_merchant_fallback_total");
      incrementDeliveryMetric("checkout_delivery_provider_selected");
      emitStructuredLog("info", "checkout_delivery_resolved", {
        merchantId: input.merchantId,
        provider: "merchant",
        source: "fixed",
        fallbackUsed: true,
      });
      return merchantResult;
    }

    incrementDeliveryMetric("checkout_delivery_unavailable_total");
    emitStructuredLog("info", "checkout_delivery_resolved", {
      merchantId: input.merchantId,
      provider: null,
      source: null,
      fallbackUsed: true,
      unavailable: true,
    });

    if (merchantResult.code === "MIN_ORDER" || merchantResult.code === "DISTANCE_UNKNOWN") {
      return merchantResult;
    }

    return {
      ok: false,
      code: "DELIVERY_UNAVAILABLE",
      message: merchantResult.message,
    };
  }

  return { resolveHybridCheckoutDelivery };
}

const defaultResolver = createHybridCheckoutDeliveryResolver();

export async function resolveHybridCheckoutDelivery(
  input: HybridCheckoutDeliveryInput,
): Promise<CheckoutDeliveryQuote> {
  return defaultResolver.resolveHybridCheckoutDelivery(input);
}
