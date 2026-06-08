import { describe, expect, it } from "vitest";
import {
  buildFooterSliderSlidesFromProducts,
  catalogFooterCanShow,
} from "../../frontend/src/components/storefront/sections/CatalogFooterSlider";
import type { Product } from "../../frontend/src/types";

function product(partial: Partial<Product> & { id: number; name: string }): Product {
  return {
    price: 100,
    image: "",
    ...partial,
  };
}

describe("catalogFooterSlider", () => {
  it("catalogFooterCanShow requires enabled and at least one slide", () => {
    const withImage = [
      product({ id: 1, name: "A", images: ["https://picsum.photos/200"] }),
    ];
    expect(catalogFooterCanShow(false, withImage)).toBe(false);
    expect(catalogFooterCanShow(true, [])).toBe(false);
    expect(catalogFooterCanShow(true, withImage)).toBe(true);
  });

  it("buildFooterSliderSlidesFromProducts uses images[] when image is empty", () => {
    const slides = buildFooterSliderSlidesFromProducts([
      product({ id: 2, name: "B", image: "", images: ["https://picsum.photos/seed/b/400"] }),
    ]);
    expect(slides).toHaveLength(1);
    expect(slides[0]?.imageUrl).toContain("picsum.photos");
    expect(slides[0]?.caption).toBe("B");
  });

  it("skips products without any image", () => {
    const slides = buildFooterSliderSlidesFromProducts([
      product({ id: 3, name: "C", image: "", images: [] }),
    ]);
    expect(slides).toHaveLength(0);
  });

  it("uses effective sale price in slide subtitle", () => {
    const slides = buildFooterSliderSlidesFromProducts([
      product({
        id: 4,
        name: "Sale",
        price: 1000,
        discountPercent: 20,
        images: ["https://picsum.photos/200"],
      }),
    ]);
    expect(slides[0]?.subtitle).toBe("800 сом");
  });
});
