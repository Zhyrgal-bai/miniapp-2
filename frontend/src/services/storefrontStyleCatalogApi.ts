import { apiAbsoluteUrl } from "./api";
import { adminFetchVoid } from "./adminRequest";

export type CatalogFooterSlideInput = {
  image?: string;
  productId?: number;
  href?: string;
  caption?: string;
};

export async function putStorefrontStyleCatalogPatch(
  businessId: number,
  body: {
    catalog?: { gridBoost?: "normal" | "bold" };
    catalogFooter?: {
      enabled?: boolean;
      title?: string;
      slides?: CatalogFooterSlideInput[];
    };
  },
): Promise<void> {
  const url = new URL(apiAbsoluteUrl("/api/merchant/storefront-style-catalog-patch"));
  url.searchParams.set("shop", String(businessId));

  await adminFetchVoid(url.toString(), {
    method: "PUT",
    businessId,
    body: JSON.stringify(body),
  });
}
