import type { ProductVariantInput } from "../shared/inventory.js";
import { parseProductVariants } from "../shared/inventory.js";
import { COMMERCE_META_ATTR_KEYS } from "../shared/productAttributeNormalization.js";
import { normalizeVariantsForSave } from "../shared/productDto.js";
import type { BusinessType } from "@prisma/client";
import { validateProductAttributesForAdmin } from "./templateValidation.js";

const RESERVED_ATTR_KEYS = new Set(["variants"]);

function pickCommerceMetaFromAttributes(
  src: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of COMMERCE_META_ATTR_KEYS) {
    if (src[key] !== undefined) {
      out[key] = src[key];
    }
  }
  return out;
}

export function mergeProductAttributesWithVariants(
  businessType: BusinessType,
  attributes: unknown,
  variants?: unknown,
  logCtx?: { businessId?: number; productId?: number },
  merchantConfig?: Record<string, unknown> | null,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string; details?: Record<string, string> } {
  const variantList =
    variants != null
      ? normalizeVariantsForSave(parseProductVariants(variants))
      : [];
  const base =
    attributes != null && typeof attributes === "object" && !Array.isArray(attributes)
      ? { ...(attributes as Record<string, unknown>) }
      : {};

  delete base.variants;

  const vAttr = validateProductAttributesForAdmin(businessType, base, logCtx, merchantConfig);
  if (!vAttr.ok) {
    const out: { ok: false; error: string; details?: Record<string, string> } = {
      ok: false,
      error: vAttr.error,
    };
    if (vAttr.details) out.details = vAttr.details;
    return out;
  }

  const merged: Record<string, unknown> = {
    ...vAttr.value,
    ...pickCommerceMetaFromAttributes(base),
  };
  if (variantList.length > 0) {
    merged.variants = variantList;
  }
  return { ok: true, value: merged };
}

export function stripReservedKeysForValidation(attributes: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attributes)) {
    if (!RESERVED_ATTR_KEYS.has(k)) out[k] = v;
  }
  return out;
}

export type { ProductVariantInput };
