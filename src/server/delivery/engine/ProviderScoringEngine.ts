import type {
  ProviderOfferCandidate,
  ProviderScoreWeights,
  ProviderSelectionStrategy,
} from "./types/deliveryEngineTypes.js";
import { DEFAULT_SCORE_WEIGHTS } from "./types/deliveryEngineTypes.js";
import type { ProviderHealthMetrics } from "./types/deliveryEngineTypes.js";
import type { MerchantDeliveryProviderPolicy } from "../../../shared/merchantDeliveryProviderPolicy.js";

export type ScoreContext = {
  policy: MerchantDeliveryProviderPolicy;
  healthByProvider: Map<string, ProviderHealthMetrics>;
  weights?: ProviderScoreWeights;
};

function healthScore(health: ProviderHealthMetrics | undefined): number {
  if (!health) return 0.5;
  switch (health.state) {
    case "HEALTHY":
      return 1;
    case "DEGRADED":
      return 0.5;
    case "UNAVAILABLE":
      return 0;
  }
}

function priorityScore(providerId: string, policy: MerchantDeliveryProviderPolicy): number {
  const idx = policy.preferredProviders.indexOf(providerId);
  if (idx < 0) return 0;
  const max = Math.max(policy.preferredProviders.length, 1);
  return 1 - idx / max;
}

export function scoreProviderOffer(
  offer: ProviderOfferCandidate,
  ctx: ScoreContext,
): number {
  const weights = ctx.weights ?? DEFAULT_SCORE_WEIGHTS;
  const health = ctx.healthByProvider.get(offer.providerId);

  const priceNorm = offer.price > 0 ? 1 / offer.price : 1;
  const etaNorm = offer.etaMinutes != null && offer.etaMinutes > 0 ? 1 / offer.etaMinutes : 0.5;
  const h = healthScore(health);
  const success = health?.successRate ?? 0.5;
  const priority = priorityScore(offer.providerId, ctx.policy);
  const availability = health?.state === "UNAVAILABLE" ? 0 : 1;

  return (
    weights.price * priceNorm +
    weights.eta * etaNorm +
    weights.health * h +
    weights.successRate * success +
    weights.merchantPriority * priority +
    weights.availability * availability
  );
}

export function rankOffersByStrategy(
  offers: ProviderOfferCandidate[],
  strategy: ProviderSelectionStrategy,
  ctx: ScoreContext,
): ProviderOfferCandidate[] {
  const scored = offers.map((o) => ({
    ...o,
    score: scoreProviderOffer(o, ctx),
  }));

  switch (strategy) {
    case "CHEAPEST":
      return [...scored].sort((a, b) => a.price - b.price);
    case "FASTEST":
      return [...scored].sort(
        (a, b) => (a.etaMinutes ?? 9999) - (b.etaMinutes ?? 9999),
      );
    case "BEST_HEALTH":
      return [...scored].sort((a, b) => {
        const ha = ctx.healthByProvider.get(a.providerId)?.successRate ?? 0;
        const hb = ctx.healthByProvider.get(b.providerId)?.successRate ?? 0;
        return hb - ha;
      });
    case "MERCHANT_PRIORITY": {
      return [...scored].sort((a, b) => {
        const pa = ctx.policy.preferredProviders.indexOf(a.providerId);
        const pb = ctx.policy.preferredProviders.indexOf(b.providerId);
        const ra = pa < 0 ? 999 : pa;
        const rb = pb < 0 ? 999 : pb;
        if (ra !== rb) return ra - rb;
        return (b.score ?? 0) - (a.score ?? 0);
      });
    }
    case "CUSTOM":
    default:
      return [...scored].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }
}

export function pickWinningOffer(
  offers: ProviderOfferCandidate[],
  strategy: ProviderSelectionStrategy,
  ctx: ScoreContext,
): ProviderOfferCandidate | null {
  const ranked = rankOffersByStrategy(offers, strategy, ctx);
  return ranked[0] ?? null;
}
