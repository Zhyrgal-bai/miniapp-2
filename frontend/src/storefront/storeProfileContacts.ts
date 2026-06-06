import type { StoreProfileContact } from "../components/storefront/StoreProfileSheet";
import type { ResolvedStorefrontSection } from "../components/storefront/StorefrontRenderer";

function readString(config: Record<string, unknown>, key: string): string {
  const v = config[key];
  return typeof v === "string" ? v.trim() : "";
}

export function extractStoreProfileContacts(
  sections: ResolvedStorefrontSection[] | undefined,
): StoreProfileContact {
  const footer = (sections ?? []).find((s) => s.type === "footer");
  const cfg = footer?.config ?? {};
  return {
    phone: readString(cfg, "phone") || null,
    instagramUrl: readString(cfg, "instagramUrl") || null,
    footerText: readString(cfg, "text") || null,
  };
}
