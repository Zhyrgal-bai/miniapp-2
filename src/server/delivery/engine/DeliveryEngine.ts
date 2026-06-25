import type { DeliveryPriceCalculateInput, DeliveryPriceResult } from "../types/deliveryPriceTypes.js";
import type {
  ProviderCreateDeliveryInput,
  ProviderCreateDeliveryResult,
} from "../providers/deliveryProviderPort.js";
import type { ProviderDeliveryFailureCode } from "../types/providerDeliveryTypes.js";
import {
  getDeliveryEnginePlugin,
  listDeliveryEnginePlugins,
} from "./ProviderRegistry.js";
import {
  createProviderPolicyResolver,
  type ProviderPolicyResolver,
} from "./ProviderPolicyResolver.js";
import { createProviderSelector } from "./ProviderSelector.js";
import {
  defaultProviderHealthService,
  type ProviderHealthService,
} from "./ProviderHealthService.js";
import type { ProviderOfferCandidate, ProviderPublicView } from "./types/deliveryEngineTypes.js";
import { defaultDeliveryOfferCache } from "../services/deliveryOfferCache.js";
import { prisma } from "../../db.js";

const RETRYABLE_FAILURE_CODES: ProviderDeliveryFailureCode[] = [
  "provider_timeout",
  "provider_rate_limit",
  "provider_unavailable",
];

export type DeliveryEngineDeps = {
  policyResolver?: ProviderPolicyResolver;
  healthService?: ProviderHealthService;
};

export function createDeliveryEngine(deps: DeliveryEngineDeps = {}) {
  const policyResolver = deps.policyResolver ?? createProviderPolicyResolver();
  const healthService = deps.healthService ?? defaultProviderHealthService;
  const selector = createProviderSelector({
    resolvePolicy: (id) => policyResolver.resolve(id),
    resolveProviderOrder: (id) => policyResolver.resolveProviderOrder(id),
  });

  async function collectOffers(
    input: DeliveryPriceCalculateInput,
  ): Promise<ProviderOfferCandidate[]> {
    const order = await policyResolver.resolveProviderOrder(input.merchantId);
    const candidates: ProviderOfferCandidate[] = [];

    for (const providerId of order) {
      const plugin = getDeliveryEnginePlugin(providerId);
      if (!plugin?.capabilities.calculatePrice || !plugin.calculatePrice) continue;

      const started = Date.now();
      const result = await plugin.calculatePrice(input);
      const durationMs = Date.now() - started;

      if (result.ok) {
        healthService.record(providerId, { type: "success", responseTimeMs: durationMs });
        candidates.push({
          providerId,
          price: result.quote.price,
          currency: result.quote.currency,
          etaMinutes: result.quote.etaMinutes,
          providerOfferId: result.quote.providerOfferId,
          expiresAt: result.quote.expiresAt,
          payload: "", // cached by plugin
        });
      } else {
        if (result.code === "provider_timeout") {
          healthService.record(providerId, { type: "timeout" });
        } else if (result.code === "provider_rate_limit") {
          healthService.record(providerId, { type: "rate_limit" });
        } else if (result.code === "provider_unavailable") {
          healthService.record(providerId, { type: "server_error" });
        } else {
          healthService.record(providerId, { type: "failure" });
        }
      }
    }

    return candidates;
  }

  async function calculateBestQuote(
    input: DeliveryPriceCalculateInput,
  ): Promise<DeliveryPriceResult> {
    const order = await policyResolver.resolveProviderOrder(input.merchantId);

    if (order.length === 1) {
      const providerId = order[0]!;
      const plugin = getDeliveryEnginePlugin(providerId);
      if (plugin?.calculatePrice) {
        const started = Date.now();
        const result = await plugin.calculatePrice(input);
        const durationMs = Date.now() - started;
        if (result.ok) {
          healthService.record(providerId, { type: "success", responseTimeMs: durationMs });
          defaultDeliveryOfferCache.put(result.quote.providerOfferId, {
            payload: "",
            merchantId: input.merchantId,
            price: result.quote.price,
            currency: result.quote.currency,
            expiresAt: result.quote.expiresAt,
            provider: providerId,
          });
        } else if (result.code === "provider_timeout") {
          healthService.record(providerId, { type: "timeout" });
        } else if (result.code === "provider_rate_limit") {
          healthService.record(providerId, { type: "rate_limit" });
        } else {
          healthService.record(providerId, { type: "failure" });
        }
        return result;
      }
    }

    const allOffers: ProviderOfferCandidate[] = [];

    for (const providerId of order) {
      const plugin = getDeliveryEnginePlugin(providerId);
      if (!plugin?.capabilities.calculatePrice || !plugin.calculatePrice) continue;

      const started = Date.now();
      const result = await plugin.calculatePrice(input);
      const durationMs = Date.now() - started;

      if (result.ok) {
        healthService.record(providerId, { type: "success", responseTimeMs: durationMs });
        defaultDeliveryOfferCache.put(result.quote.providerOfferId, {
          payload: "", // yandex plugin caches payload internally
          merchantId: input.merchantId,
          price: result.quote.price,
          currency: result.quote.currency,
          expiresAt: result.quote.expiresAt,
          provider: providerId,
        });
        allOffers.push({
          providerId,
          price: result.quote.price,
          currency: result.quote.currency,
          etaMinutes: result.quote.etaMinutes,
          providerOfferId: result.quote.providerOfferId,
          expiresAt: result.quote.expiresAt,
          payload: "",
        });
        // Return first success when only one provider — yandex caches payload in its service
        if (order.length === 1) return result;
      } else {
        if (result.code === "provider_timeout") {
          healthService.record(providerId, { type: "timeout" });
        } else if (result.code === "provider_rate_limit") {
          healthService.record(providerId, { type: "rate_limit" });
        } else {
          healthService.record(providerId, { type: "failure" });
        }
        const policy = await policyResolver.resolve(input.merchantId);
        if (!policy.allowFallback) return result;
      }
    }

    const winner = await selector.selectBestOffer(input.merchantId, allOffers);
    if (!winner) {
      return {
        ok: false,
        code: "provider_unavailable",
        message: "Нет доступных провайдеров доставки.",
      };
    }

    // Re-fetch quote from winning provider for correct offer id / cache
    const plugin = getDeliveryEnginePlugin(winner.providerId);
    if (plugin?.calculatePrice) {
      const result = await plugin.calculatePrice(input);
      if (result.ok) {
        defaultDeliveryOfferCache.put(result.quote.providerOfferId, {
          payload: "",
          merchantId: input.merchantId,
          price: result.quote.price,
          currency: result.quote.currency,
          expiresAt: result.quote.expiresAt,
          provider: winner.providerId,
        });
        return {
          ok: true,
          quote: { ...result.quote, provider: winner.providerId },
        };
      }
    }

    return {
      ok: true,
      quote: {
        provider: winner.providerId,
        available: true,
        price: winner.price,
        currency: winner.currency,
        etaMinutes: winner.etaMinutes,
        providerOfferId: winner.providerOfferId,
        expiresAt: winner.expiresAt,
      },
    };
  }

  async function createAndAcceptWithFailover(
    input: ProviderCreateDeliveryInput,
    startProviderId?: string,
  ): Promise<ProviderCreateDeliveryResult & { providerId?: string }> {
    const order = await selector.selectFailoverOrder(input.merchantId);
    const tryOrder =
      startProviderId != null
        ? [startProviderId, ...order.filter((id) => id !== startProviderId)]
        : order;

    let lastFailure: ProviderCreateDeliveryResult | null = null;

    for (const providerId of tryOrder) {
      const plugin = getDeliveryEnginePlugin(providerId);
      if (!plugin?.capabilities.createClaim || !plugin.createAndAccept) continue;

      const started = Date.now();
      const result = await plugin.createAndAccept(input);
      const durationMs = Date.now() - started;

      if (result.ok) {
        healthService.record(providerId, { type: "success", responseTimeMs: durationMs });
        return { ...result, providerId };
      }

      healthService.record(providerId, { type: "failure" });
      lastFailure = result;

      const policy = await policyResolver.resolve(input.merchantId);
      if (!policy.allowFallback) break;
      if (!RETRYABLE_FAILURE_CODES.includes(result.code)) break;
    }

    return lastFailure ?? {
      ok: false,
      code: "provider_unavailable",
      message: "Все провайдеры доставки недоступны.",
    };
  }

  async function listPublicProviders(): Promise<ProviderPublicView[]> {
    const plugins = listDeliveryEnginePlugins();
    const views: ProviderPublicView[] = [];

    for (const plugin of plugins) {
      const available = await plugin.isAvailable();
      const health = healthService.getMetrics(plugin.providerId);

      const agg = await prisma.providerDelivery.aggregate({
        where: { provider: plugin.providerId },
        _avg: { price: true, etaMinutes: true },
      });

      views.push({
        providerId: plugin.providerId,
        displayName: plugin.displayName,
        capabilities: plugin.capabilities,
        health,
        averageEtaMinutes:
          agg._avg.etaMinutes != null ? Math.round(agg._avg.etaMinutes) : null,
        averagePrice: agg._avg.price != null ? Math.round(agg._avg.price) : null,
        status: health.state,
        available,
      });
    }

    return views;
  }

  return {
    calculateBestQuote,
    createAndAcceptWithFailover,
    listPublicProviders,
    collectOffers,
  };
}

const defaultEngine = createDeliveryEngine();

export async function calculateBestDeliveryQuote(
  input: DeliveryPriceCalculateInput,
): Promise<DeliveryPriceResult> {
  return defaultEngine.calculateBestQuote(input);
}

export async function createDeliveryWithFailover(
  input: ProviderCreateDeliveryInput,
  startProviderId?: string,
): Promise<ProviderCreateDeliveryResult & { providerId?: string }> {
  return defaultEngine.createAndAcceptWithFailover(input, startProviderId);
}

export async function listDeliveryProvidersPublic(): Promise<ProviderPublicView[]> {
  return defaultEngine.listPublicProviders();
}

export {
  resolveHybridCheckoutDelivery,
  createHybridCheckoutDeliveryResolver,
} from "./hybridCheckoutDeliveryResolver.js";
