/**
 * Настройки доставки мерчанта (Phase 4) — pricing mode, min order, тарифы.
 */

export type MerchantDeliveryPricingMode =
  | "SELF_PICKUP"
  | "FIXED_PRICE"
  | "DISTANCE_BASED"
  | "FREE_DELIVERY"
  | "MANUAL_CONFIRMATION";

export type MerchantDistanceTier = {
  /** Верхняя граница сегмента в км (не включительно для следующего). null = всё дальше. */
  maxKm: number | null;
  priceSom: number;
};

export type MerchantDeliverySettings = {
  version: 1;
  pricingMode: MerchantDeliveryPricingMode;
  /** Минимальная сумма товаров (сом) для оформления заказа. */
  minOrderAmountSom: number;
  /** FIXED_PRICE */
  fixedPriceSom: number;
  /** DISTANCE_BASED — отсортированные сегменты. */
  distanceTiers: MerchantDistanceTier[];
};

export type DeliveryQuoteInput = {
  settings: MerchantDeliverySettings;
  /** DELIVERY | PICKUP (Prisma DeliveryMode) */
  fulfillmentMode: "DELIVERY" | "PICKUP";
  subtotalSom: number;
  /** Расстояние магазин → клиент в км; нужно для DISTANCE_BASED. */
  distanceKm: number | null;
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
    pricingMode: "FREE_DELIVERY",
    minOrderAmountSom: 0,
    fixedPriceSom: 0,
    distanceTiers: DEFAULT_DISTANCE_TIERS.map((t) => ({ ...t })),
  };
}

const PRICING_MODES: MerchantDeliveryPricingMode[] = [
  "SELF_PICKUP",
  "FIXED_PRICE",
  "DISTANCE_BASED",
  "FREE_DELIVERY",
  "MANUAL_CONFIRMATION",
];

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
  return {
    ok: true,
    value: {
      version: 1,
      pricingMode,
      minOrderAmountSom,
      fixedPriceSom,
      distanceTiers,
    },
  };
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
    default:
      return mode;
  }
}

/** Публичное представление для витрины / checkout (без секретов). */
export function merchantDeliverySettingsToPublic(settings: MerchantDeliverySettings) {
  return {
    pricingMode: settings.pricingMode,
    minOrderAmountSom: settings.minOrderAmountSom,
    fixedPriceSom: settings.fixedPriceSom,
    distanceTiers: settings.distanceTiers,
    manualConfirmationNotice:
      settings.pricingMode === "MANUAL_CONFIRMATION"
        ? "Стоимость доставки будет сообщена после подтверждения заказа."
        : null,
    pickupOnly: settings.pricingMode === "SELF_PICKUP",
  };
}
