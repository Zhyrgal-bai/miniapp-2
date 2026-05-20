import { ru } from "./ru";

type RuTree = typeof ru;

/** Resolve dot-path key from ru tree, e.g. t('admin.analyticsSubtitle') */
export function t(key: string, fallback?: string): string {
  const parts = key.split(".");
  let node: unknown = ru;
  for (const p of parts) {
    if (node == null || typeof node !== "object") {
      return fallback ?? key;
    }
    node = (node as Record<string, unknown>)[p];
  }
  if (typeof node === "string") return node;
  return fallback ?? key;
}

/** Merchant storefront override: use API text if set, else platform default. */
export function readStorefrontText(
  config: Record<string, unknown> | null | undefined,
  key: string,
  platformDefault: string,
): string {
  const v = config?.[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : platformDefault;
}

export type { RuTree };
