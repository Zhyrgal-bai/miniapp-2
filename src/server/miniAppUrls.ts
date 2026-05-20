import { prisma } from "./db.js";

function storefrontBaseUrl(): string {
  return (
    process.env.FRONTEND_URL ||
    process.env.FRONT_URL ||
    process.env.PUBLIC_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
}

/** Mini App deep link to merchant admin orders for a tenant. */
export async function buildMerchantAdminOrdersWebAppUrl(
  businessId: number,
): Promise<string | null> {
  const base = storefrontBaseUrl();
  if (!base) return null;

  try {
    const row = await prisma.business.findUnique({
      where: { id: businessId },
      select: { slug: true },
    });
    const slug =
      row?.slug != null && String(row.slug).trim() !== ""
        ? String(row.slug).trim().toLowerCase()
        : null;
    if (slug) {
      return `${base}/s/${encodeURIComponent(slug)}#/admin/orders`;
    }
  } catch {
    /* fallback below */
  }

  return `${base}/?shop=${encodeURIComponent(String(businessId))}#/admin/orders`;
}
