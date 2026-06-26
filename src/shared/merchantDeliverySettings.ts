/**
 * Настройки доставки мерчанта — hybrid providers (Yandex + merchant regions).
 */

import {
  DEFAULT_MERCHANT_REGIONS,
  migrateMerchantDeliverySettings,
} from "./merchantDeliveryMigration.js";

export type MerchantDeliveryPricingMode =
  | "SELF_PICKUP"
  | "FIXED_PRICE"
  | "DISTANCE_BASED"
  | "FREE_DELIVERY"
  | "MANUAL_CONFIRMATION"
  | "REGION_BASED";

export type MerchantDistanceTier = {
  /** Верхняя граница сегмента в км (не включительно для следующего). null = всё дальше. */
  maxKm: number | null;
  priceSom: number;
};

export type MerchantDeliveryRegion = {
  id: string;
  name: string;
  priceSom: number;
  notes?: string | null;
};

export type MerchantDeliverySettings = {
  version: 1;
  pricingMode: MerchantDeliveryPricingMode;
  /** Минимальная сумма товаров (сом) для оформления заказа. */
  minOrderAmountSom: number;
  /** @deprecated Legacy FIXED_PRICE */
  fixedPriceSom: number;
  /** @deprecated Legacy DISTANCE_BASED */
  distanceTiers: MerchantDistanceTier[];
  /** Merchant-owned regional fixed prices (REGION_BASED). */
  regions: MerchantDeliveryRegion[];
  /** Merchant fallback delivery enabled (REGION_BASED). */
  merchantDeliveryEnabled: boolean;
};

export type DeliveryQuoteInput = {
  settings: MerchantDeliverySettings;
  /** DELIVERY | PICKUP (Prisma DeliveryMode) */
  fulfillmentMode: "DELIVERY" | "PICKUP";
  subtotalSom: number;
  /** Расстояние магазин → клиент в км; legacy distance tiers / radius cap. */
  distanceKm: number | null;
  /** Адрес или населённый пункт — deprecated fallback (Phase 9.1). */
  destinationLabel?: string | null;
  /** Structured locality from checkout (Phase 9.1). */
  destinationLocality?: DeliveryDestinationLocality | null;
};

export type DeliveryQuote = {
  ok: true;
  deliveryFeeSom: number;
  /** Сумма к оплате = subtotal + deliveryFee (без промо). */
  goodsPlusDeliverySom: number;
  manualConfirmation: boolean;
  minOrderMet: boolean;
  minOrderAmountSom: number;
  pricingMode: MerchantDeliveryPricingMode;
  distanceKm: number | null;
  message: string | null;
};

export type DeliveryQuoteError = {
  ok: false;
  error: string;
  code:
    | "MIN_ORDER"
    | "PICKUP_ONLY"
    | "DELIVERY_DISABLED"
    | "DISTANCE_UNKNOWN"
    | "DELIVERY_UNAVAILABLE"
    | "INVALID_SETTINGS";
};

export const DEFAULT_DISTANCE_TIERS: MerchantDistanceTier[] = [
  { maxKm: 3, priceSom: 0 },
  { maxKm: 5, priceSom: 100 },
  { maxKm: 10, priceSom: 150 },
  { maxKm: 15, priceSom: 200 },
  { maxKm: null, priceSom: 250 },
];

export function defaultMerchantDeliverySettings(): MerchantDeliverySettings {
  return {
    version: 1,
    pricingMode: "REGION_BASED",
    minOrderAmountSom: 0,
    fixedPriceSom: 0,
    distanceTiers: DEFAULT_DISTANCE_TIERS.map((t) => ({ ...t })),
    regions: DEFAULT_MERCHANT_REGIONS.map((r) => ({ ...r })),
    merchantDeliveryEnabled: true,
  };
}

const PRICING_MODES: MerchantDeliveryPricingMode[] = [
  "SELF_PICKUP",
  "FIXED_PRICE",
  "DISTANCE_BASED",
  "FREE_DELIVERY",
  "MANUAL_CONFIRMATION",
  "REGION_BASED",
];

function parseRegion(raw: unknown): MerchantDeliveryRegion | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const name = String(o.name ?? "").trim();
  if (name.length < 2) return null;
  const idRaw = String(o.id ?? "").trim();
  const id =
    idRaw !== ""
      ? idRaw
      : name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");
  const notesRaw = o.notes;
  const notes =
    typeof notesRaw === "string" && notesRaw.trim() !== "" ? notesRaw.trim() : null;
  return {
    id: id || `region-${name}`,
    name,
    priceSom: clampSom(Number(o.priceSom)),
    notes,
  };
}

import type { DeliveryDestinationLocality } from "./merchantDeliveryLocality.js";
import { resolveMerchantDeliveryRegionWithMeta, isBishkekCityName } from "./merchantDeliveryLocality.js";

export type {
  DeliveryDestinationLocality,
  MerchantRegionMatchSource,
  MerchantRegionMatchResult,
} from "./merchantDeliveryLocality.js";
export {
  normalizeLocalityPart,
  localityFromNominatimAddress,
  parseCityFromDisplayAddress,
} from "./merchantDeliveryLocality.js";

function clampSom(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function parseTier(raw: unknown): MerchantDistanceTier | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const maxRaw = o.maxKm;
  const maxKm =
    maxRaw === null || maxRaw === undefined
      ? null
      : typeof maxRaw === "number" && Number.isFinite(maxRaw)
        ? maxRaw
        : Number(String(maxRaw ?? "").trim());
  if (maxKm != null && (!Number.isFinite(maxKm) || maxKm <= 0)) return null;
  const priceSom = clampSom(Number(o.priceSom));
  return { maxKm: maxKm != null ? maxKm : null, priceSom };
}

export function parseMerchantDeliverySettings(
  raw: unknown,
): { ok: true; value: MerchantDeliverySettings } | { ok: false; error: string } {
  const base = defaultMerchantDeliverySettings();
  if (raw == null || (typeof raw === "object" && Object.keys(raw as object).length === 0)) {
    return { ok: true, value: base };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Некорректные настройки доставки." };
  }
  const o = raw as Record<string, unknown>;
  const modeRaw = String(o.pricingMode ?? base.pricingMode).trim().toUpperCase();
  if (!PRICING_MODES.includes(modeRaw as MerchantDeliveryPricingMode)) {
    return { ok: false, error: "Некорректный режим доставки" };
  }
  const pricingMode = modeRaw as MerchantDeliveryPricingMode;
  const minOrderAmountSom = clampSom(Number(o.minOrderAmountSom ?? base.minOrderAmountSom));
  const fixedPriceSom = clampSom(Number(o.fixedPriceSom ?? base.fixedPriceSom));
  let distanceTiers = base.distanceTiers;
  if (Array.isArray(o.distanceTiers) && o.distanceTiers.length > 0) {
    const parsed = o.distanceTiers.map(parseTier).filter((t): t is MerchantDistanceTier => t != null);
    if (parsed.length === 0) {
      return { ok: false, error: "Некорректные тарифы по расстоянию" };
    }
    distanceTiers = parsed;
  }
  if (pricingMode === "FIXED_PRICE" && fixedPriceSom <= 0) {
    return { ok: false, error: "Укажите стоимость фиксированной доставки" };
  }
  if (pricingMode === "DISTANCE_BASED") {
    const sorted = [...distanceTiers].sort((a, b) => {
      const am = a.maxKm ?? Number.POSITIVE_INFINITY;
      const bm = b.maxKm ?? Number.POSITIVE_INFINITY;
      return am - bm;
    });
    distanceTiers = sorted;
  }

  let regions = base.regions;
  if (Array.isArray(o.regions) && o.regions.length > 0) {
    const parsed = o.regions.map(parseRegion).filter((r): r is MerchantDeliveryRegion => r != null);
    if (parsed.length === 0) {
      return { ok: false, error: "Некорректные регионы доставки" };
    }
    regions = parsed;
  }

  const merchantDeliveryEnabled =
    o.merchantDeliveryEnabled === false ? false : o.merchantDeliveryEnabled === true ? true : base.merchantDeliveryEnabled;

  const value = migrateMerchantDeliverySettings({
    version: 1,
    pricingMode,
    minOrderAmountSom,
    fixedPriceSom,
    distanceTiers,
    regions,
    merchantDeliveryEnabled,
  });

  if (value.pricingMode === "REGION_BASED" && value.merchantDeliveryEnabled && value.regions.length === 0) {
    return { ok: false, error: "Добавьте хотя бы один регион доставки" };
  }

  return { ok: true, value };
}

export function haversineDistanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function feeFromDistanceTiers(
  tiers: MerchantDistanceTier[],
  distanceKm: number,
): number {
  for (const tier of tiers) {
    if (tier.maxKm == null || distanceKm <= tier.maxKm) {
      return clampSom(tier.priceSom);
    }
  }
  const last = tiers[tiers.length - 1];
  return last ? clampSom(last.priceSom) : 0;
}

export function computeDeliveryQuote(
  input: DeliveryQuoteInput,
): DeliveryQuote | DeliveryQuoteError {
  const settings = input.settings;
  const subtotalSom = clampSom(input.subtotalSom);
  const minOrderMet = subtotalSom >= settings.minOrderAmountSom;

  if (!minOrderMet) {
    return {
      ok: false,
      error: `Минимальная сумма заказа — ${settings.minOrderAmountSom} сом`,
      code: "MIN_ORDER",
    };
  }

  if (settings.pricingMode === "SELF_PICKUP") {
    if (input.fulfillmentMode === "DELIVERY") {
      return {
        ok: false,
        error: "Доступен только самовывоз",
        code: "PICKUP_ONLY",
      };
    }
    return {
      ok: true,
      deliveryFeeSom: 0,
      goodsPlusDeliverySom: subtotalSom,
      manualConfirmation: false,
      minOrderMet: true,
      minOrderAmountSom: settings.minOrderAmountSom,
      pricingMode: settings.pricingMode,
      distanceKm: input.distanceKm,
      message: null,
    };
  }

  if (input.fulfillmentMode === "PICKUP") {
    return {
      ok: true,
      deliveryFeeSom: 0,
      goodsPlusDeliverySom: subtotalSom,
      manualConfirmation: false,
      minOrderMet: true,
      minOrderAmountSom: settings.minOrderAmountSom,
      pricingMode: settings.pricingMode,
      distanceKm: input.distanceKm,
      message: null,
    };
  }

  switch (settings.pricingMode) {
    case "FREE_DELIVERY":
      return {
        ok: true,
        deliveryFeeSom: 0,
        goodsPlusDeliverySom: subtotalSom,
        manualConfirmation: false,
        minOrderMet: true,
        minOrderAmountSom: settings.minOrderAmountSom,
        pricingMode: settings.pricingMode,
        distanceKm: input.distanceKm,
        message: null,
      };
    case "FIXED_PRICE":
      return {
        ok: true,
        deliveryFeeSom: settings.fixedPriceSom,
        goodsPlusDeliverySom: subtotalSom + settings.fixedPriceSom,
        manualConfirmation: false,
        minOrderMet: true,
        minOrderAmountSom: settings.minOrderAmountSom,
        pricingMode: settings.pricingMode,
        distanceKm: input.distanceKm,
        message: null,
      };
    case "MANUAL_CONFIRMATION":
      return {
        ok: true,
        deliveryFeeSom: 0,
        goodsPlusDeliverySom: subtotalSom,
        manualConfirmation: true,
        minOrderMet: true,
        minOrderAmountSom: settings.minOrderAmountSom,
        pricingMode: settings.pricingMode,
        distanceKm: input.distanceKm,
        message: "Стоимость доставки будет сообщена после подтверждения заказа.",
      };
    case "DISTANCE_BASED": {
      if (input.distanceKm == null || !Number.isFinite(input.distanceKm)) {
        return {
          ok: false,
          error: "Укажите местоположение для расчёта доставки",
          code: "DISTANCE_UNKNOWN",
        };
      }
      const fee = feeFromDistanceTiers(settings.distanceTiers, input.distanceKm);
      return {
        ok: true,
        deliveryFeeSom: fee,
        goodsPlusDeliverySom: subtotalSom + fee,
        manualConfirmation: false,
        minOrderMet: true,
        minOrderAmountSom: settings.minOrderAmountSom,
        pricingMode: settings.pricingMode,
        distanceKm: input.distanceKm,
        message: null,
      };
    }
    case "REGION_BASED": {
      if (!settings.merchantDeliveryEnabled) {
        return {
          ok: false,
          error: "Доставка магазином отключена",
          code: "DELIVERY_DISABLED",
        };
      }
      const { region } = resolveMerchantDeliveryRegionWithMeta(settings.regions, {
        locality: input.destinationLocality ?? null,
        destinationLabel: input.destinationLabel ?? null,
        distanceKm: input.distanceKm,
      });
      if (!region) {
        return {
          ok: false,
          error: "Доставка в этот регион недоступна",
          code: "DELIVERY_UNAVAILABLE",
        };
      }
      if (isBishkekCityName(region.name)) {
        return {
          ok: false,
          error: "Доставка в Бишкеке выполняется через Yandex Delivery",
          code: "DELIVERY_UNAVAILABLE",
        };
      }
      const manual = Boolean(region.notes?.toLowerCase().includes("уточн"));
      return {
        ok: true,
        deliveryFeeSom: region.priceSom,
        goodsPlusDeliverySom: subtotalSom + region.priceSom,
        manualConfirmation: manual,
        minOrderMet: true,
        minOrderAmountSom: settings.minOrderAmountSom,
        pricingMode: settings.pricingMode,
        distanceKm: input.distanceKm,
        message: manual
          ? "Стоимость доставки будет сообщена после подтверждения заказа."
          : region.notes ?? null,
      };
    }
    default:
      return { ok: false, error: "Некорректные настройки доставки", code: "INVALID_SETTINGS" };
  }
}

export function deliveryPricingModeLabelRu(mode: MerchantDeliveryPricingMode): string {
  switch (mode) {
    case "SELF_PICKUP":
      return "Только самовывоз";
    case "FIXED_PRICE":
      return "Фиксированная доставка";
    case "DISTANCE_BASED":
      return "По расстоянию";
    case "FREE_DELIVERY":
      return "Бесплатная доставка";
    case "MANUAL_CONFIRMATION":
      return "Рассчитывает менеджер";
    case "REGION_BASED":
      return "Региональная доставка";
    default:
      return mode;
  }
}

/** Публичное представление для витрины / checkout (без секретов). */
export function merchantDeliverySettingsToPublic(settings: MerchantDeliverySettings) {
  const migrated = migrateMerchantDeliverySettings(settings);
  return {
    pricingMode: migrated.pricingMode,
    minOrderAmountSom: migrated.minOrderAmountSom,
    fixedPriceSom: migrated.fixedPriceSom,
    distanceTiers: migrated.distanceTiers,
    regions: migrated.regions.map((r) => ({
      id: r.id,
      name: r.name,
      priceSom: r.priceSom,
      notes: r.notes ?? null,
    })),
    merchantDeliveryEnabled: migrated.merchantDeliveryEnabled,
    manualConfirmationNotice:
      migrated.regions.some((r) => r.notes?.toLowerCase().includes("уточн"))
        ? "Стоимость доставки будет сообщена после подтверждения заказа."
        : null,
    pickupOnly:
      !migrated.merchantDeliveryEnabled &&
      (migrated.pricingMode === "REGION_BASED" || migrated.pricingMode === "SELF_PICKUP"),
  };
}

export { migrateMerchantDeliverySettings, DEFAULT_MERCHANT_REGIONS } from "./merchantDeliveryMigration.js";

/** @returns matched region or null (see `resolveMerchantDeliveryRegionWithMeta` for match source). */
export function resolveMerchantDeliveryRegion(
  regions: MerchantDeliveryRegion[],
  input: {
    locality?: DeliveryDestinationLocality | null;
    destinationLabel?: string | null;
    distanceKm?: number | null;
  },
): MerchantDeliveryRegion | null {
  return resolveMerchantDeliveryRegionWithMeta(regions, input).region;
}

export { resolveMerchantDeliveryRegionWithMeta } from "./merchantDeliveryLocality.js";
