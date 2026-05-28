import { apiAbsoluteUrl } from "./api";
import { adminFetchVoid } from "./adminRequest";

export type CatalogFooterSlideInput = {
  image?: string;
  productId?: number;
  href?: string;
  caption?: string;
};

export type HeroShowcasePatchInput = {
  autoMove?: boolean;
  direction?: "left" | "right";
  speed?: "slow" | "medium" | "fast";
  pauseOnTouch?: boolean;
  pauseOnHover?: boolean;
  infiniteLoop?: boolean;
};

export async function putStorefrontStyleCatalogPatch(
  businessId: number,
  body: {
    catalog?: { gridBoost?: "normal" | "bold" };
    hero?: { showcase?: HeroShowcasePatchInput };
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
