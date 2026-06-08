import type { BusinessTypeId, TargetBusinessTypeId } from "../../shared/businessTypes.js";
import { parseStoreAvailabilitySettings } from "../../shared/storeAvailabilitySettings.js";

export type UniversalClassifierInput = {
  merchantConfig: Record<string, unknown> | null | undefined;
  productSignals?: {
    total: number;
    withVin: number;
    withCompatibility: number;
    withSpecifications: number;
    withIngredients: number;
    withDimensions: number;
    withVolume: number;
  };
};

export type UniversalClassifierResult = {
  proposedType: TargetBusinessTypeId;
  confidence: "low" | "medium" | "high";
  reasons: string[];
  ambiguous: boolean;
};

function asObj(v: unknown): Record<string, unknown> {
  if (v != null && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

function score(
  input: UniversalClassifierInput,
): Record<TargetBusinessTypeId, number> {
  const cfg = asObj(input.merchantConfig);
  const sig = input.productSignals ?? {
    total: 0,
    withVin: 0,
    withCompatibility: 0,
    withSpecifications: 0,
    withIngredients: 0,
    withDimensions: 0,
    withVolume: 0,
  };
  const s: Record<TargetBusinessTypeId, number> = {
    clothing: 0,
    flowers: 0,
    coffee: 0,
    fastfood: 0,
    electronics: 0,
    autoparts: 0,
    cosmetics: 0,
    furniture: 0,
  };

  if (cfg.enableSizes === true && cfg.enableColors === true) s.clothing += 4;
  if (cfg.enableSizes === true) s.clothing += 2;
  if (cfg.enableOrderOptions === true) {
    s.coffee += 1;
    s.fastfood += 1;
    s.flowers += 1;
  }
  if (cfg.reservationDepositEnabled === true) {
    s.coffee += 2;
    s.fastfood += 2;
  }
  if (cfg.deliveryEnabled === true) {
    s.flowers += 1;
    s.fastfood += 1;
    s.cosmetics += 1;
  }
  if (cfg.urgentDelivery === true || cfg.postcards === true) s.flowers += 3;
  if (cfg.comboEnabled === true) s.fastfood += 3;
  if (cfg.hasTables === true) s.coffee += 2;
  if (cfg.enableCompatibility === true || cfg.enableVin === true) s.autoparts += 4;
  if (cfg.enableSpecifications === true) s.electronics += 2;
  if (cfg.enableKit === true) s.electronics += 1;
  if (cfg.enableVolume === true) s.cosmetics += 1;

  if (sig.total > 0) {
    if (sig.withVin > 0 || sig.withCompatibility > 0) s.autoparts += 4;
    if (sig.withSpecifications > 0) s.electronics += 2;
    if (sig.withIngredients > 0) s.cosmetics += 3;
    if (sig.withDimensions > 0) s.furniture += 3;
    if (sig.withVolume > 0) {
      s.coffee += 1;
      s.cosmetics += 1;
    }
  }

  const bt = String(cfg.businessTypeHint ?? "").trim().toLowerCase() as BusinessTypeId;
  if (bt === "clothing" || bt === "flowers" || bt === "coffee" || bt === "fastfood" || bt === "electronics" || bt === "autoparts" || bt === "cosmetics" || bt === "furniture") {
    s[bt] += 5;
  }

  // Use parsed schedule preset-like shape as weak hint.
  const av = parseStoreAvailabilitySettings(cfg.storeAvailabilitySettings, "");
  if (av.ok) {
    const mon = av.value.schedule.mon;
    if (mon.open <= "09:00") s.flowers += 1;
    if (mon.close >= "23:00") s.fastfood += 1;
  }

  return s;
}

export function classifyUniversalBusiness(
  input: UniversalClassifierInput,
): UniversalClassifierResult {
  const scores = score(input);
  const ranked = Object.entries(scores)
    .sort((a, b) => b[1] - a[1]) as Array<[TargetBusinessTypeId, number]>;
  const top = ranked[0] ?? ["clothing", 0];
  const second = ranked[1] ?? ["flowers", 0];
  const delta = top[1] - second[1];
  const confidence: UniversalClassifierResult["confidence"] =
    top[1] >= 6 && delta >= 3 ? "high" : top[1] >= 3 && delta >= 1 ? "medium" : "low";
  const reasons = [`score:${top[0]}=${top[1]}`, `delta=${delta}`];
  return {
    proposedType: top[0],
    confidence,
    reasons,
    ambiguous: confidence === "low",
  };
}

