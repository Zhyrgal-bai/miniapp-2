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

  it("implements real ClothingProductCard with size chips", () => {
    const src = read(
      "frontend/src/components/storefront/product/cards/ClothingProductCard.tsx",
    );
    expect(src.includes("clothing-card__size")).toBe(true);
    expect(src.includes("clothing-card__color")).toBe(true);
    expect(src.includes("useStorefrontRetailCard")).toBe(true);
    expect(src.includes("<ProductCard")).toBe(false);
  });

  it("implements real FlowersProductCard with bouquet and delivery badges", () => {
    const src = read(
      "frontend/src/components/storefront/product/cards/FlowersProductCard.tsx",
    );
    expect(src.includes("flowers-card__badge")).toBe(true);
    expect(src.includes("flowers-card__chip")).toBe(true);
    expect(src.includes("useStorefrontRetailCard")).toBe(true);
    expect(src.includes("<ProductCard")).toBe(false);
  });

  it("wires dedicated clothing, flowers, fastfood, coffee and electronics PDP content in ProductModalHost", () => {
    const host = read(
      "frontend/src/components/storefront/product/host/ProductModalHost.tsx",
    );
    expect(host.includes("ClothingPdpContent")).toBe(true);
    expect(host.includes("FlowersPdpContent")).toBe(true);
    expect(host.includes("FastfoodPdpContent")).toBe(true);
    expect(host.includes("CoffeePdpContent")).toBe(true);
    expect(host.includes("ElectronicsPdpContent")).toBe(true);
    expect(host.includes("AutopartsPdpContent")).toBe(true);
    expect(host.includes("CosmeticsPdpContent")).toBe(true);
    expect(host.includes("FurniturePdpContent")).toBe(true);
    expect(
      read("frontend/src/components/storefront/product/modal/content/FastfoodPdpContent.tsx").includes(
        "VerticalOrderOptionsExperience",
      ),
    ).toBe(true);
    expect(
      read("frontend/src/components/storefront/product/modal/content/CoffeePdpContent.tsx").includes(
        "VerticalOrderOptionsExperience",
      ),
    ).toBe(true);
  });

  it("implements real FastfoodProductCard with food-order badges", () => {
    const src = read(
      "frontend/src/components/storefront/product/cards/FastfoodProductCard.tsx",
    );
    expect(src.includes("fastfood-card__badge")).toBe(true);
    expect(src.includes("fastfood-card__fact")).toBe(true);
    expect(src.includes("useStorefrontRetailCard")).toBe(true);
    expect(src.includes("<ProductCard")).toBe(false);
  });

  it("implements real CoffeeProductCard with cup and temperature chips", () => {
    const src = read(
      "frontend/src/components/storefront/product/cards/CoffeeProductCard.tsx",
    );
    expect(src.includes("coffee-card__chip")).toBe(true);
    expect(src.includes("coffee-card__badge")).toBe(true);
    expect(src.includes("useStorefrontRetailCard")).toBe(true);
    expect(src.includes("<ProductCard")).toBe(false);
  });

  it("implements real ElectronicsProductCard with warranty and stock badges", () => {
    const src = read(
      "frontend/src/components/storefront/product/cards/ElectronicsProductCard.tsx",
    );
    expect(src.includes("electronics-card__chip")).toBe(true);
    expect(src.includes("electronics-card__badge")).toBe(true);
    expect(src.includes("electronics-card__stock")).toBe(true);
    expect(src.includes("useStorefrontRetailCard")).toBe(true);
    expect(src.includes("<ProductCard")).toBe(false);
  });

  it("implements ElectronicsPdpContent with specs and memory picker", () => {
    const src = read(
      "frontend/src/components/storefront/product/modal/content/ElectronicsPdpContent.tsx",
    );
    expect(src.includes("electronics-pdp__specs")).toBe(true);
    expect(src.includes("px-block--memory")).toBe(true);
    expect(src.includes("PdpStickyBar")).toBe(true);
  });

  it("implements real AutopartsProductCard with brand, sku and compatibility chips", () => {
    const src = read(
      "frontend/src/components/storefront/product/cards/AutopartsProductCard.tsx",
    );
    expect(src.includes("autoparts-card__chip")).toBe(true);
    expect(src.includes("autoparts-card__stock")).toBe(true);
    expect(src.includes("useStorefrontRetailCard")).toBe(true);
    expect(src.includes("<ProductCard")).toBe(false);
  });

  it("implements AutopartsPdpContent with fitment block and VIN order options", () => {
    const src = read(
      "frontend/src/components/storefront/product/modal/content/AutopartsPdpContent.tsx",
    );
    expect(src.includes("autoparts-pdp__fitment")).toBe(true);
    expect(src.includes("VerticalOrderOptionsExperience")).toBe(true);
    expect(src.includes("PdpStickyBar")).toBe(true);
  });

  it("implements real CosmeticsProductCard with shade, volume and skin type chips", () => {
    const src = read(
      "frontend/src/components/storefront/product/cards/CosmeticsProductCard.tsx",
    );
    expect(src.includes("cosmetics-card__chip")).toBe(true);
    expect(src.includes("cosmetics-card__badge")).toBe(true);
    expect(src.includes("SKIN_TYPE_RU")).toBe(true);
    expect(src.includes("useStorefrontRetailCard")).toBe(true);
    expect(src.includes("<ProductCard")).toBe(false);
  });

  it("implements CosmeticsPdpContent with ingredients and usage guide", () => {
    const src = read(
      "frontend/src/components/storefront/product/modal/content/CosmeticsPdpContent.tsx",
    );
    expect(src.includes("px-block--ingredients")).toBe(true);
    expect(src.includes("px-block--usage")).toBe(true);
    expect(src.includes("PdpStickyBar")).toBe(true);
  });

  it("implements real FurnitureProductCard with dimensions, material and color chips", () => {
    const src = read(
      "frontend/src/components/storefront/product/cards/FurnitureProductCard.tsx",
    );
    expect(src.includes("furniture-card__chip")).toBe(true);
    expect(src.includes("furniture-card__badge")).toBe(true);
    expect(src.includes("colorFamily")).toBe(true);
    expect(src.includes("useStorefrontRetailCard")).toBe(true);
    expect(src.includes("<ProductCard")).toBe(false);
  });

  it("implements FurniturePdpContent with specs, assembly and delivery", () => {
    const src = read(
      "frontend/src/components/storefront/product/modal/content/FurniturePdpContent.tsx",
    );
    expect(src.includes("furniture-pdp__specs")).toBe(true);
    expect(src.includes("px-block--assembly")).toBe(true);
    expect(src.includes("PdpStickyBar")).toBe(true);
  });
});
