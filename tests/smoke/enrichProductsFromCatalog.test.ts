import { describe, expect, it } from "vitest";
import { enrichProductsFromCatalog } from "../../frontend/src/utils/enrichProductsFromCatalog.ts";
import type { Product } from "../../frontend/src/types/index.ts";

describe("enrichProductsFromCatalog", () => {
  it("merges inventory from catalog into featured payload rows", () => {
    const featured: Product[] = [
      { id: 1, name: "Rose", price: 100, image: "a.jpg" },
    ];
    const catalog: Product[] = [
      {
        id: 1,
        name: "Rose",
        price: 100,
        image: "a.jpg",
        totalAvailable: 5,
        variants: [{ color: "default", sizes: [{ size: "21", stock: 5 }] }],
      },
    ];
    const out = enrichProductsFromCatalog(featured, catalog);
    expect(out[0]?.totalAvailable).toBe(5);
    expect(out[0]?.variants?.[0]?.sizes[0]?.stock).toBe(5);
  });

  it("returns list unchanged when catalog empty", () => {
    const featured: Product[] = [
      { id: 1, name: "Rose", price: 100, image: "a.jpg", totalAvailable: 3 },
    ];
    expect(enrichProductsFromCatalog(featured, [])).toEqual(featured);
  });
});
