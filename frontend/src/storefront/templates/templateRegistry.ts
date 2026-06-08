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

export type FrontendTemplateModalBehavior = {
  mode: "centered_v2";
  maxWidth: "sm" | "md" | "lg";
  stickyActionBar: boolean;
};

export type FrontendTemplateDescriptor = {
  businessTypeId: string;
  cardRendererId: StorefrontTemplateCardRendererId;
  modalRendererId: StorefrontTemplateModalRendererId;
  catalogBehavior: FrontendTemplateCatalogBehavior;
  modalBehavior: FrontendTemplateModalBehavior;
};

type RendererPickContext = {
  businessType: string | null | undefined;
  product?: Product;
  templateDescriptor?: Record<string, unknown> | null;
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
  modalBehavior: {
    mode: "centered_v2",
    maxWidth: "md",
    stickyActionBar: true,
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
    modalBehavior: {
      mode: "centered_v2",
      maxWidth: "md",
      stickyActionBar: true,
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
    modalBehavior: {
      mode: "centered_v2",
      maxWidth: "md",
      stickyActionBar: true,
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
    modalBehavior: {
      mode: "centered_v2",
      maxWidth: "md",
      stickyActionBar: true,
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
    modalBehavior: {
      mode: "centered_v2",
      maxWidth: "md",
      stickyActionBar: true,
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
    modalBehavior: {
      mode: "centered_v2",
      maxWidth: "lg",
      stickyActionBar: true,
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
    modalBehavior: {
      mode: "centered_v2",
      maxWidth: "lg",
      stickyActionBar: true,
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
    modalBehavior: {
      mode: "centered_v2",
      maxWidth: "md",
      stickyActionBar: true,
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
    modalBehavior: {
      mode: "centered_v2",
      maxWidth: "lg",
      stickyActionBar: true,
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
    modalBehavior: {
      mode: "centered_v2",
      maxWidth: "md",
      stickyActionBar: true,
    },
  },
};

function normalizeCardRendererId(
  raw: unknown,
): StorefrontTemplateCardRendererId | null {
  if (
    raw === "clothing" ||
    raw === "flowers" ||
    raw === "coffee" ||
    raw === "fastfood" ||
    raw === "electronics" ||
    raw === "autoparts" ||
    raw === "cosmetics" ||
    raw === "furniture" ||
    raw === "generic"
  ) {
    return raw;
  }
  return null;
}

function normalizeModalRendererId(
  raw: unknown,
): StorefrontTemplateModalRendererId | null {
  if (raw === "product-experience-v2" || raw === "generic-v2") return raw;
  return null;
}

function normalizeCatalogBehavior(
  raw: unknown,
): FrontendTemplateCatalogBehavior | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const cardPlaceholder =
    typeof obj.cardPlaceholder === "string" && obj.cardPlaceholder.trim() !== ""
      ? obj.cardPlaceholder.trim()
      : null;
  const imageRatioHint =
    obj.imageRatioHint === "portrait" ||
    obj.imageRatioHint === "square" ||
    obj.imageRatioHint === "landscape"
      ? obj.imageRatioHint
      : null;
  const imageFitHint =
    obj.imageFitHint === "cover" || obj.imageFitHint === "contain"
      ? obj.imageFitHint
      : null;
  if (cardPlaceholder == null || imageRatioHint == null || imageFitHint == null) {
    return null;
  }
  return { cardPlaceholder, imageRatioHint, imageFitHint };
}

function normalizeModalBehavior(
  raw: unknown,
): FrontendTemplateModalBehavior | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.mode !== "centered_v2") return null;
  if (obj.maxWidth !== "sm" && obj.maxWidth !== "md" && obj.maxWidth !== "lg") {
    return null;
  }
  if (typeof obj.stickyActionBar !== "boolean") return null;
  return {
    mode: obj.mode,
    maxWidth: obj.maxWidth,
    stickyActionBar: obj.stickyActionBar,
  };
}

export function storefrontTemplateDescriptorFor(
  businessType: string | null | undefined,
): FrontendTemplateDescriptor {
  const key = String(businessType ?? "").trim().toLowerCase();
  return DESCRIPTORS[key] ?? FALLBACK_DESCRIPTOR;
}

export function storefrontTemplateDescriptorForContext(
  ctx: RendererPickContext,
): FrontendTemplateDescriptor {
  const fallback = storefrontTemplateDescriptorFor(ctx.businessType);
  const source = ctx.templateDescriptor;
  if (source == null || typeof source !== "object" || Array.isArray(source)) {
    return fallback;
  }
  const cardRendererId = normalizeCardRendererId(source.cardRendererId);
  const modalRendererId = normalizeModalRendererId(source.modalRendererId);
  const catalogBehavior = normalizeCatalogBehavior(source.catalogBehavior);
  const modalBehavior = normalizeModalBehavior(source.modalBehavior);
  if (
    cardRendererId == null ||
    modalRendererId == null ||
    catalogBehavior == null ||
    modalBehavior == null
  ) {
    return fallback;
  }
  const businessTypeId =
    typeof source.businessType === "string" && source.businessType.trim() !== ""
      ? source.businessType.trim().toLowerCase()
      : fallback.businessTypeId;
  return {
    businessTypeId,
    cardRendererId,
    modalRendererId,
    catalogBehavior,
    modalBehavior,
  };
}

export function resolveCardRendererId(
  ctx: RendererPickContext,
): StorefrontTemplateCardRendererId {
  return storefrontTemplateDescriptorForContext(ctx).cardRendererId;
}

export function resolveModalRendererId(
  ctx: RendererPickContext,
): StorefrontTemplateModalRendererId {
  return storefrontTemplateDescriptorForContext(ctx).modalRendererId;
}

export function resolveCatalogBehavior(
  ctx: RendererPickContext,
): FrontendTemplateCatalogBehavior {
  return storefrontTemplateDescriptorForContext(ctx).catalogBehavior;
}

export function resolveModalBehavior(
  ctx: RendererPickContext,
): FrontendTemplateModalBehavior {
  return storefrontTemplateDescriptorForContext(ctx).modalBehavior;
}

