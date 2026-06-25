import type { ProviderSelectionStrategy } from "../server/delivery/engine/types/deliveryEngineTypes.js";

export type MerchantDeliveryProviderPolicy = {
  version: 1;
  /** Platform provider engine enabled for this merchant. */
  enabled: boolean;
  strategy: ProviderSelectionStrategy;
  /** Priority order — first = highest preference for MERCHANT_PRIORITY. */
  preferredProviders: string[];
  preferredProvider: string | null;
  maxPriceSom: number | null;
  maxEtaMinutes: number | null;
  allowFallback: boolean;
  allowAutoSwitch: boolean;
  autoSelection: boolean;
};

export function defaultMerchantDeliveryProviderPolicy(): MerchantDeliveryProviderPolicy {
  return {
    version: 1,
    enabled: true,
    strategy: "MERCHANT_PRIORITY",
    preferredProviders: ["yandex"],
    preferredProvider: "yandex",
    maxPriceSom: null,
    maxEtaMinutes: null,
    allowFallback: true,
    allowAutoSwitch: true,
    autoSelection: true,
  };
}

const STRATEGIES: ProviderSelectionStrategy[] = [
  "CHEAPEST",
  "FASTEST",
  "BEST_HEALTH",
  "MERCHANT_PRIORITY",
  "CUSTOM",
];

export function parseMerchantDeliveryProviderPolicy(
  raw: unknown,
): { ok: true; value: MerchantDeliveryProviderPolicy } | { ok: false; error: string } {
  if (raw == null || typeof raw !== "object") {
    return { ok: true, value: defaultMerchantDeliveryProviderPolicy() };
  }
  const o = raw as Record<string, unknown>;
  const strategy = typeof o.strategy === "string" && STRATEGIES.includes(o.strategy as ProviderSelectionStrategy)
    ? (o.strategy as ProviderSelectionStrategy)
    : "MERCHANT_PRIORITY";

  const preferredProviders = Array.isArray(o.preferredProviders)
    ? o.preferredProviders.filter((p): p is string => typeof p === "string" && p.trim() !== "")
    : ["yandex"];

  return {
    ok: true,
    value: {
      version: 1,
      enabled: o.enabled !== false,
      strategy,
      preferredProviders: preferredProviders.length > 0 ? preferredProviders : ["yandex"],
      preferredProvider: typeof o.preferredProvider === "string" ? o.preferredProvider : preferredProviders[0] ?? "yandex",
      maxPriceSom: typeof o.maxPriceSom === "number" && o.maxPriceSom > 0 ? o.maxPriceSom : null,
      maxEtaMinutes: typeof o.maxEtaMinutes === "number" && o.maxEtaMinutes > 0 ? o.maxEtaMinutes : null,
      allowFallback: o.allowFallback !== false,
      allowAutoSwitch: o.allowAutoSwitch !== false,
      autoSelection: o.autoSelection !== false,
    },
  };
}

/** Extract providerPolicy from Business.deliverySettings JSON blob. */
export function extractProviderPolicyFromDeliverySettings(
  deliverySettingsRaw: unknown,
): MerchantDeliveryProviderPolicy {
  if (deliverySettingsRaw == null || typeof deliverySettingsRaw !== "object") {
    return defaultMerchantDeliveryProviderPolicy();
  }
  const nested = (deliverySettingsRaw as Record<string, unknown>).providerPolicy;
  const parsed = parseMerchantDeliveryProviderPolicy(nested);
  return parsed.ok ? parsed.value : defaultMerchantDeliveryProviderPolicy();
}
