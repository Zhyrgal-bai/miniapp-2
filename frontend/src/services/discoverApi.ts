import { api, apiAbsoluteUrl } from "./api";

export type DiscoverStoreCard = {
  slug: string;
  displayName: string;
  tagline: string | null;
  logoUrl: string | null;
  businessType: string;
  featured: boolean;
  openPath: string;
};

export async function fetchDiscoverStores(input?: {
  featured?: boolean;
  type?: string;
  q?: string;
}): Promise<DiscoverStoreCard[]> {
  const url = new URL(apiAbsoluteUrl("/api/discover/stores"));
  if (input?.featured) url.searchParams.set("featured", "1");
  if (input?.type) url.searchParams.set("type", input.type);
  if (input?.q) url.searchParams.set("q", input.q);
  const res = await api.get<{ items?: DiscoverStoreCard[] }>(url.pathname + url.search);
  return Array.isArray(res.data?.items) ? res.data.items : [];
}
