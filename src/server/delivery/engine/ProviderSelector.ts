import type { MerchantDeliveryProviderPolicy } from "../../../shared/merchantDeliveryProviderPolicy.js";
import type { ProviderOfferCandidate, ProviderSelectionStrategy } from "./types/deliveryEngineTypes.js";
import { getProviderHealthMetrics } from "./ProviderHealthService.js";
import { pickWinningOffer, type ScoreContext } from "./ProviderScoringEngine.js";

export type ProviderSelectorDeps = {
  resolvePolicy: (merchantId: number) => Promise<MerchantDeliveryProviderPolicy>;
  resolveProviderOrder: (merchantId: number) => Promise<string[]>;
};

export function createProviderSelector(deps: ProviderSelectorDeps) {
  async function buildScoreContext(
    policy: MerchantDeliveryProviderPolicy,
    providerIds: string[],
  ): Promise<ScoreContext> {
    const healthByProvider = new Map(
      providerIds.map((id) => [id, getProviderHealthMetrics(id)]),
    );
    return { policy, healthByProvider };
  }

  function filterByPolicy(
    offers: ProviderOfferCandidate[],
    policy: MerchantDeliveryProviderPolicy,
  ): ProviderOfferCandidate[] {
    return offers.filter((o) => {
      if (policy.maxPriceSom != null && o.price > policy.maxPriceSom) return false;
      if (
        policy.maxEtaMinutes != null &&
        o.etaMinutes != null &&
        o.etaMinutes > policy.maxEtaMinutes
      ) {
        return false;
      }
      const health = getProviderHealthMetrics(o.providerId);
      if (health.state === "UNAVAILABLE") return false;
      return true;
    });
  }

  async function selectBestOffer(
    merchantId: number,
    offers: ProviderOfferCandidate[],
    strategyOverride?: ProviderSelectionStrategy,
  ): Promise<ProviderOfferCandidate | null> {
    const policy = await deps.resolvePolicy(merchantId);
    if (!policy.enabled || offers.length === 0) return null;

    const filtered = filterByPolicy(offers, policy);
    if (filtered.length === 0) return null;

    const strategy = strategyOverride ?? policy.strategy;
    const ctx = await buildScoreContext(
      policy,
      filtered.map((o) => o.providerId),
    );
    return pickWinningOffer(filtered, strategy, ctx);
  }

  async function selectFailoverOrder(merchantId: number): Promise<string[]> {
    const policy = await deps.resolvePolicy(merchantId);
    const order = await deps.resolveProviderOrder(merchantId);
    if (!policy.allowFallback) {
      const preferred = policy.preferredProvider ?? order[0];
      return preferred ? [preferred] : order;
    }
    return order;
  }

  return { selectBestOffer, selectFailoverOrder, filterByPolicy };
}
