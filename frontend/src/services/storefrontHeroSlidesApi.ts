import { apiAbsoluteUrl } from "./api";
import { adminFetchVoid } from "./adminRequest";

export type HeroSlideInput = {
  imageUrl: string;
  imagePublicId?: string;
};

export async function putStorefrontHeroSlidesPatch(
  businessId: number,
  body: { slides: HeroSlideInput[] },
): Promise<void> {
  const url = new URL(apiAbsoluteUrl("/api/merchant/storefront-hero-slides-patch"));
  url.searchParams.set("shop", String(businessId));

  await adminFetchVoid(url.toString(), {
    method: "PUT",
    businessId,
    body: JSON.stringify(body),
  });
}
