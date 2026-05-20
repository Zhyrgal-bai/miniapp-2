import { api, TENANT_HEADER } from "./api";

export type StorefrontRecommendationItem = {
  productId: number;
  name: string;
  score: number;
};

export async function fetchStorefrontRecommendations(input: {
  businessId: number;
  productId?: number | null;
  limit?: number;
}): Promise<number[]> {
  const { businessId, productId, limit = 8 } = input;
  if (!Number.isInteger(businessId) || businessId <= 0) return [];
  try {
    const params: Record<string, string | number> = { limit };
    if (productId != null && productId > 0) params.productId = productId;
    const res = await api.get<{ items?: StorefrontRecommendationItem[] }>(
      "/api/storefront/recommendations",
      {
        params,
        headers: { [TENANT_HEADER]: String(businessId) },
      },
    );
    const items = Array.isArray(res.data?.items) ? res.data.items : [];
    return items
      .map((i) => Number(i.productId))
      .filter((id) => Number.isInteger(id) && id > 0);
  } catch {
    return [];
  }
}
