import {
  BUSINESS_TYPE_IDS,
  type BusinessTypeId,
  type TargetBusinessTypeId,
} from "../../shared/businessTypes.js";
import {
  clothingTemplate,
} from "../clothing.js";
import { flowersTemplate } from "../flowers.js";
import { coffeeTemplate } from "../coffee.js";
import { fastfoodTemplate } from "../fastfood.js";
import { electronicsTemplate } from "../electronics.js";
import { autopartsTemplate } from "../autoparts.js";
import { cosmeticsTemplate } from "../cosmetics.js";
import { furnitureTemplate } from "../furniture.js";
import { universalTemplate } from "../universal.js";
import type { BusinessTemplateDescriptor } from "../types.js";

type RegistryShape = Record<BusinessTypeId, BusinessTemplateDescriptor>;

const TEMPLATE_REGISTRY: RegistryShape = {
  universal: universalTemplate,
  clothing: clothingTemplate,
  flowers: flowersTemplate,
  coffee: coffeeTemplate,
  fastfood: fastfoodTemplate,
  electronics: electronicsTemplate,
  autoparts: autopartsTemplate,
  cosmetics: cosmeticsTemplate,
  furniture: furnitureTemplate,
};

/** Allowed in new registrations/wizard cards. */
export const TARGET_TEMPLATE_REGISTRY: Record<
  TargetBusinessTypeId,
  BusinessTemplateDescriptor
> = {
  clothing: TEMPLATE_REGISTRY.clothing,
  flowers: TEMPLATE_REGISTRY.flowers,
  coffee: TEMPLATE_REGISTRY.coffee,
  fastfood: TEMPLATE_REGISTRY.fastfood,
  electronics: TEMPLATE_REGISTRY.electronics,
  autoparts: TEMPLATE_REGISTRY.autoparts,
  cosmetics: TEMPLATE_REGISTRY.cosmetics,
  furniture: TEMPLATE_REGISTRY.furniture,
};

export function getBusinessTemplateDescriptor(
  businessType: BusinessTypeId,
): BusinessTemplateDescriptor {
  const hit = TEMPLATE_REGISTRY[businessType];
  if (hit) return hit;
  return TEMPLATE_REGISTRY.clothing;
}

export function listBusinessTemplateDescriptors(): BusinessTemplateDescriptor[] {
  return BUSINESS_TYPE_IDS.map((id) => TEMPLATE_REGISTRY[id]);
}

