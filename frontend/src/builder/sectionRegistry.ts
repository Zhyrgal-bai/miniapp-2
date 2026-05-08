import type { SectionLibraryItem } from "./sectionLibrary/types";
import { SECTION_LIBRARY } from "./sectionLibrary/library";

export type SectionRegistryItem = SectionLibraryItem & {
  editorKey:
    | "hero"
    | "promo"
    | "categories"
    | "featuredProducts"
    | "footer"
    | "unsupported";
};

const byType = new Map<string, SectionRegistryItem>(
  SECTION_LIBRARY.map((x) => {
    const editorKey =
      x.type === "hero"
        ? "hero"
        : x.type === "promo"
          ? "promo"
          : x.type === "categories"
            ? "categories"
            : x.type === "featuredProducts"
              ? "featuredProducts"
              : x.type === "footer"
                ? "footer"
                : "unsupported";
    return [x.type, { ...x, editorKey }];
  }),
);

export function registryByType(type: string): SectionRegistryItem | null {
  return byType.get(type) ?? null;
}

export function stableSectionId(prefix: string): string {
  const p = prefix.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) || "section";
  const g = globalThis;
  if ("crypto" in g) {
    const c = g.crypto;
    if (c && typeof c.randomUUID === "function") return `${p}-${c.randomUUID()}`;
  }
  // Fallback (stable-enough, not cryptographic): 128-bit-ish random string.
  const rand = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  return `${p}-${rand()}${rand()}${rand()}${rand()}`;
}

