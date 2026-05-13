import { apiAbsoluteUrl, withTenantHeaders } from "./api";
import { getWebAppUserId } from "../utils/telegramUserId";

export type CatalogFooterSlideInput = {
  image: string;
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
  const userId = getWebAppUserId();
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error("Откройте в Telegram Mini App");
  }
  const url = new URL(apiAbsoluteUrl("/api/merchant/storefront-style-catalog-patch"));
  url.searchParams.set("shop", String(businessId));
  url.searchParams.set("userId", String(userId));

  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: withTenantHeaders(
      { "Content-Type": "application/json" },
      url.toString(),
      { businessId },
    ),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let err = text;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (typeof j.error === "string") err = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(err || `HTTP ${res.status}`);
  }
}
