import type { BusinessTypeId } from "../shared/businessTypes.js";
import { clothingTemplate } from "./clothing.js";
import { coffeeTemplate } from "./coffee.js";
import { fastfoodTemplate } from "./fastfood.js";
import { flowersTemplate } from "./flowers.js";
import { electronicsTemplate } from "./electronics.js";
import { autopartsTemplate } from "./autoparts.js";
import { cosmeticsTemplate } from "./cosmetics.js";
import { furnitureTemplate } from "./furniture.js";
import { universalTemplate } from "./universal.js";
import type { BusinessTemplateConfig } from "./types.js";
import { getBusinessTemplateDescriptor } from "./registry/businessTemplateRegistry.js";

export type BusinessType =
  | "universal"
  | "clothing"
  | "coffee"
  | "fastfood"
  | "flowers"
  | "electronics"
  | "autoparts"
  | "cosmetics"
  | "furniture";

export const CURRENT_TEMPLATE_VERSION = 1;

export const BUSINESS_TEMPLATES: Record<BusinessType, BusinessTemplateConfig> = {
  universal: universalTemplate,
  clothing: clothingTemplate,
  coffee: coffeeTemplate,
  fastfood: fastfoodTemplate,
  flowers: flowersTemplate,
  electronics: electronicsTemplate,
  autoparts: autopartsTemplate,
  cosmetics: cosmeticsTemplate,
  furniture: furnitureTemplate,
};

export function templateForBusinessType(
  businessType: BusinessType,
): BusinessTemplateConfig {
  if (BUSINESS_TEMPLATES[businessType]) return BUSINESS_TEMPLATES[businessType];
  return getBusinessTemplateDescriptor(
    businessType as unknown as BusinessTypeId,
  );
}

