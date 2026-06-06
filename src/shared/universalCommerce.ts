import type { SchemaObject } from "../templates/types.js";
import type { VerticalCommerceProfile } from "./businessCommerce.js";

/** Base profile before merchant feature toggles are applied. */
export const UNIVERSAL_VERTICAL_BASE: VerticalCommerceProfile = {
  businessType: "universal",
  inventoryMode: "metadata_only",
  primaryAxisKey: "size",
  primaryAxisLabel: "Вариант",
  secondaryAxisKey: null,
  secondaryAxisLabel: null,
  showFashionVariantMatrix: false,
  showOrderOptionsOnStorefront: false,
  variantEditor: "none",
  defaultPrimaryValues: [],
  cardPlaceholder: "Выберите параметры",
};

/** Merchant toggles → productSchema field keys for universal stores. */
export const UNIVERSAL_PRODUCT_FIELD_FLAGS: Record<string, string> = {
  enableSku: "sku",
  enableBrand: "brand",
  enableModel: "model",
  enableWeight: "weight",
  enableVolume: "volume",
  enableWarranty: "warranty",
  enableKit: "kitContents",
  enableVin: "vin",
  enableCompatibility: "compatibility",
  enableSerial: "serialNumber",
  enableSpecifications: "specifications",
};

export function filterUniversalProductSchema(
  fullSchema: SchemaObject,
  merchantConfig: Record<string, unknown> | null | undefined,
): SchemaObject {
  const cfg = merchantConfig ?? {};
  const out: SchemaObject = {};
  for (const [flag, fieldKey] of Object.entries(UNIVERSAL_PRODUCT_FIELD_FLAGS)) {
    if (cfg[flag] === true && fullSchema[fieldKey]) {
      out[fieldKey] = fullSchema[fieldKey]!;
    }
  }
  return out;
}

export function resolveUniversalVerticalProfile(
  merchantConfig: Record<string, unknown> | null | undefined,
): VerticalCommerceProfile {
  const cfg = merchantConfig ?? {};
  const base = UNIVERSAL_VERTICAL_BASE;
  const enableSizes = cfg.enableSizes === true;
  const enableColors = cfg.enableColors === true;
  const enableVariants = cfg.enableVariants === true;
  const enableOrderOptions = cfg.enableOrderOptions === true;

  if (enableColors && enableSizes) {
    return {
      ...base,
      inventoryMode: "sku_matrix",
      variantEditor: "clothing_matrix",
      showFashionVariantMatrix: true,
      primaryAxisLabel: "Размер",
      secondaryAxisKey: "color",
      secondaryAxisLabel: "Цвет",
      showOrderOptionsOnStorefront: enableOrderOptions,
    };
  }

  if (enableSizes) {
    return {
      ...base,
      inventoryMode: "single_axis",
      variantEditor: "tier_stock",
      primaryAxisLabel: "Размер",
      showOrderOptionsOnStorefront: enableOrderOptions,
    };
  }

  if (enableColors) {
    return {
      ...base,
      inventoryMode: "single_axis",
      variantEditor: "tier_stock",
      primaryAxisLabel: "Цвет",
      showOrderOptionsOnStorefront: enableOrderOptions,
    };
  }

  if (enableVariants) {
    return {
      ...base,
      inventoryMode: "single_axis",
      variantEditor: "tier_stock",
      primaryAxisLabel: "Вариант",
      showOrderOptionsOnStorefront: enableOrderOptions,
    };
  }

  return {
    ...base,
    showOrderOptionsOnStorefront: enableOrderOptions,
  };
}

export function effectiveProductSchemaForBusiness(
  businessType: string,
  fullProductSchema: SchemaObject,
  merchantConfig: Record<string, unknown> | null | undefined,
): SchemaObject {
  if (businessType === "universal") {
    return filterUniversalProductSchema(fullProductSchema, merchantConfig);
  }
  return fullProductSchema;
}
