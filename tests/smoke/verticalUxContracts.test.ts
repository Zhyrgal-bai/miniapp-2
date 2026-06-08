import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

describe("vertical ux contracts", () => {
  it("routes discovery rails through ProductCardHost", () => {
    const src = read(
      "frontend/src/components/storefront/discovery/CommerceDiscoveryFeed.tsx",
    );
    expect(src.includes("ProductCardHost")).toBe(true);
    expect(src.includes("<ProductCardHost")).toBe(true);
  });

  it("provides vertical modal content strategy components", () => {
    const src = read(
      "frontend/src/components/storefront/product/modal/content/VerticalModalContents.tsx",
    );
    expect(src.includes("ElectronicsProductModalContent")).toBe(true);
    expect(src.includes("AutopartsProductModalContent")).toBe(true);
    expect(src.includes("CosmeticsProductModalContent")).toBe(true);
    expect(src.includes("FurnitureProductModalContent")).toBe(true);
  });

  it("applies descriptor-aware modal behavior in ProductModalHost", () => {
    const src = read(
      "frontend/src/components/storefront/product/host/ProductModalHost.tsx",
    );
    expect(src.includes("resolveModalBehavior")).toBe(true);
    expect(src.includes("maxWidth={modalBehavior.maxWidth}")).toBe(true);
  });

  it("uses cardHint in ProductCard rendering", () => {
    const src = read("frontend/src/components/product/ProductCard.tsx");
    expect(src.includes("const cardHint =")).toBe(true);
    expect(src.includes("retail-card__hint")).toBe(true);
    expect(src.includes("product-subtitle")).toBe(true);
  });
});

