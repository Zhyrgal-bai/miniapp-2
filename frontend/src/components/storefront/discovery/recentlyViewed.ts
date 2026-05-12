import { getRecentlyViewedProductIds, recordViewProduct } from "../runtime/commerceSession";
import type { Product } from "../../../types";

// Backward-compat shim: old helpers now delegate to CommerceSession (tenant-scoped).
export function recordRecentlyViewed(params: { businessId: number; product: Product }) {
  recordViewProduct({ businessId: params.businessId, product: params.product });
}

export function getRecentlyViewedIds(businessId: number): number[] {
  return getRecentlyViewedProductIds(businessId);
}

