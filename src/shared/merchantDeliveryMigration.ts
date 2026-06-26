import type {
  MerchantDeliveryPricingMode,
  MerchantDeliveryRegion,
  MerchantDeliverySettings,
  MerchantDistanceTier,
} from "./merchantDeliverySettings.js";

export const DEFAULT_MERCHANT_REGIONS: MerchantDeliveryRegion[] = [
  { id: "bishkek", name: "Бишкек", priceSom: 150, notes: null },
  { id: "kant", name: "Кант", priceSom: 250, notes: null },
  { id: "tokmok", name: "Токмок", priceSom: 300, notes: null },
  { id: "kara-balta", name: "Кара-Балта", priceSom: 350, notes: null },
];

const LEGACY_MODES: MerchantDeliveryPricingMode[] = [
  "SELF_PICKUP",
  "FIXED_PRICE",
  "DISTANCE_BASED",
  "FREE_DELIVERY",
  "MANUAL_CONFIRMATION",
];

export function isLegacyDeliveryPricingMode(
  mode: MerchantDeliveryPricingMode,
): boolean {
  return LEGACY_MODES.includes(mode);
}

function tiersToRegions(tiers: MerchantDistanceTier[]): MerchantDeliveryRegion[] {
  return tiers.map((tier, index) => ({
    id: `tier-${index}`,
    name:
      tier.maxKm != null
        ? `До ${tier.maxKm} км`
        : index === tiers.length - 1
          ? "Дальше"
          : `Тариф ${index + 1}`,
    priceSom: tier.priceSom,
    notes: null,
  }));
}

/** Map legacy pricing modes to hybrid region-based merchant delivery. */
export function migrateMerchantDeliverySettings(
  settings: MerchantDeliverySettings,
): MerchantDeliverySettings {
  if (settings.pricingMode === "REGION_BASED") {
    return {
      ...settings,
      regions:
        settings.regions.length > 0
          ? settings.regions
          : DEFAULT_MERCHANT_REGIONS.map((r) => ({ ...r })),
    };
  }

  switch (settings.pricingMode) {
    case "SELF_PICKUP":
      return {
        ...settings,
        pricingMode: "REGION_BASED",
        merchantDeliveryEnabled: false,
        regions: [],
      };
    case "FIXED_PRICE":
      return {
        ...settings,
        pricingMode: "REGION_BASED",
        merchantDeliveryEnabled: true,
        regions: [
          {
            id: "fixed",
            name: "Доставка",
            priceSom: settings.fixedPriceSom,
            notes: null,
          },
        ],
      };
    case "FREE_DELIVERY":
      return {
        ...settings,
        pricingMode: "REGION_BASED",
        merchantDeliveryEnabled: true,
        regions: [{ id: "free", name: "Доставка", priceSom: 0, notes: null }],
      };
    case "MANUAL_CONFIRMATION":
      return {
        ...settings,
        pricingMode: "REGION_BASED",
        merchantDeliveryEnabled: true,
        regions: [
          {
            id: "manual",
            name: "Доставка",
            priceSom: 0,
            notes: "Стоимость уточняется у менеджера",
          },
        ],
      };
    case "DISTANCE_BASED":
      return {
        ...settings,
        pricingMode: "REGION_BASED",
        merchantDeliveryEnabled: true,
        regions:
          settings.distanceTiers.length > 0
            ? tiersToRegions(settings.distanceTiers)
            : DEFAULT_MERCHANT_REGIONS.map((r) => ({ ...r })),
      };
    default:
      return settings;
  }
}
