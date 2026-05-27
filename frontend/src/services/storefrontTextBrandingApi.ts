import { apiAbsoluteUrl } from "./api";
import { adminFetchVoid } from "./adminRequest";

export async function putStorefrontTextBrandingPatch(
  businessId: number,
  body: {
    brandTagline?: string;
    drawerTagline?: string;
  },
): Promise<void> {
  const url = new URL(apiAbsoluteUrl("/api/merchant/storefront-text-branding-patch"));
  url.searchParams.set("shop", String(businessId));

  await adminFetchVoid(url.toString(), {
    method: "PUT",
    businessId,
    body: JSON.stringify(body),
  });
}
