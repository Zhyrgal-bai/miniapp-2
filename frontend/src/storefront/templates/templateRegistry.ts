import type { Product } from "../../types";

export type StorefrontTemplateCardRendererId =
  | "clothing"
  | "flowers"
  | "coffee"
  | "fastfood"
  | "electronics"
  | "autoparts"
  | "cosmetics"
  | "furniture"
  | "generic";

export type StorefrontTemplateModalRendererId =
  | "product-experience-v2"
  | "generic-v2";

export type FrontendTemplateCatalogBehavior = {
  cardPlaceholder: string;
  imageRatioHint: "portrait" | "square" | "landscape";
  imageFitHint: "cover" | "contain";
};

export type FrontendTemplateDescriptor = {
  businessTypeId: string;
  cardRendererId: StorefrontTemplateCardRendererId;
  modalRendererId: StorefrontTemplateModalRendererId;
  catalogBehavior: FrontendTemplateCatalogBehavior;
};

type RendererPickContext = {
  businessType: string | null | undefined;
  product?: Product;
};

const FALLBACK_DESCRIPTOR: FrontendTemplateDescriptor = {
  businessTypeId: "clothing",
  cardRendererId: "generic",
  modalRendererId: "product-experience-v2",
  catalogBehavior: {
    cardPlaceholder: "Выберите параметры",
    imageRatioHint: "square",
    imageFitHint: "cover",
  },
};

const DESCRIPTORS: Record<string, FrontendTemplateDescriptor> = {
  clothing: {
    businessTypeId: "clothing",
    cardRendererId: "clothing",
    modalRendererId: "product-experience-v2",
    catalogBehavior: {
      cardPlaceholder: "Выберите размер и цвет",
      imageRatioHint: "portrait",
      imageFitHint: "cover",
    },
  },
  flowers: {
    businessTypeId: "flowers",
    cardRendererId: "flowers",
    modalRendererId: "product-experience-v2",
    catalogBehavior: {
      cardPlaceholder: "21 роза",
      imageRatioHint: "portrait",
      imageFitHint: "cover",
    },
  },
  coffee: {
    businessTypeId: "coffee",
    cardRendererId: "coffee",
    modalRendererId: "product-experience-v2",
    catalogBehavior: {
      cardPlaceholder: "350 мл • горячий",
      imageRatioHint: "square",
      imageFitHint: "cover",
    },
  },
  fastfood: {
    businessTypeId: "fastfood",
    cardRendererId: "fastfood",
    modalRendererId: "product-experience-v2",
    catalogBehavior: {
      cardPlaceholder: "Средняя порция",
      imageRatioHint: "square",
      imageFitHint: "cover",
    },
  },
  electronics: {
    businessTypeId: "electronics",
    cardRendererId: "electronics",
    modalRendererId: "product-experience-v2",
    catalogBehavior: {
      cardPlaceholder: "Выберите характеристики",
      imageRatioHint: "square",
      imageFitHint: "contain",
    },
  },
  autoparts: {
    businessTypeId: "autoparts",
    cardRendererId: "autoparts",
    modalRendererId: "product-experience-v2",
    catalogBehavior: {
      cardPlaceholder: "Проверьте совместимость",
      imageRatioHint: "square",
      imageFitHint: "contain",
    },
  },
  cosmetics: {
    businessTypeId: "cosmetics",
    cardRendererId: "cosmetics",
    modalRendererId: "product-experience-v2",
    catalogBehavior: {
      cardPlaceholder: "Выберите объём",
      imageRatioHint: "portrait",
      imageFitHint: "cover",
    },
  },
  furniture: {
    businessTypeId: "furniture",
    cardRendererId: "furniture",
    modalRendererId: "product-experience-v2",
    catalogBehavior: {
      cardPlaceholder: "Выберите комплектацию",
      imageRatioHint: "landscape",
      imageFitHint: "cover",
    },
  },
  universal: {
    businessTypeId: "universal",
    cardRendererId: "generic",
    modalRendererId: "generic-v2",
    catalogBehavior: {
      cardPlaceholder: "Выберите параметры",
      imageRatioHint: "square",
      imageFitHint: "contain",
    },
  },
};

export function storefrontTemplateDescriptorFor(
  businessType: string | null | undefined,
): FrontendTemplateDescriptor {
  const key = String(businessType ?? "").trim().toLowerCase();
  return DESCRIPTORS[key] ?? FALLBACK_DESCRIPTOR;
}

export function resolveCardRendererId(
  ctx: RendererPickContext,
): StorefrontTemplateCardRendererId {
  return storefrontTemplateDescriptorFor(ctx.businessType).cardRendererId;
}

export function resolveModalRendererId(
  ctx: RendererPickContext,
): StorefrontTemplateModalRendererId {
  return storefrontTemplateDescriptorFor(ctx.businessType).modalRendererId;
}

