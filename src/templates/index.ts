import { clothingTemplate } from "./clothing.js";
import { coffeeTemplate } from "./coffee.js";
import { fastfoodTemplate } from "./fastfood.js";
import { flowersTemplate } from "./flowers.js";
import { universalTemplate } from "./universal.js";
import type { BusinessTemplateConfig } from "./types.js";

export type BusinessType =
  | "universal"
  | "clothing"
  | "coffee"
  | "fastfood"
  | "flowers";

export const CURRENT_TEMPLATE_VERSION = 1;

export const BUSINESS_TEMPLATES: Record<BusinessType, BusinessTemplateConfig> = {
  universal: universalTemplate,
  clothing: clothingTemplate,
  coffee: coffeeTemplate,
  fastfood: fastfoodTemplate,
  flowers: flowersTemplate,
};

export function templateForBusinessType(
  businessType: BusinessType,
): BusinessTemplateConfig {
  const t = BUSINESS_TEMPLATES[businessType];
  if (!t) {
    // Safe fallback: no crash, but no schema/sections.
    return {
      businessType,
      templateVersion: CURRENT_TEMPLATE_VERSION,
      theme: { templateId: "dark", themeConfig: {} as any },
      defaultCategories: [],
      merchantConfig: {},
      productSchema: {},
      merchantSettingsSchema: {},
      orderOptionsSchema: {},
      demoProducts: [],
    };
  }
  return t;
}

