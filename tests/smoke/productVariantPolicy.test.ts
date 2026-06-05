import { describe, expect, it } from "vitest";
import {
  productRequiresVariantPicker,
  resolveInstantAddLine,
} from "../../frontend/src/commerce/productVariantPolicy";
import type { Product } from "../../frontend/src/types";

function clothingProduct(): Product {
  return {
    id: 1,
    name: "Футболка",
    price: 1200,
    image: "",
    businessType: "clothing",
    variants: [
      {
        color: "black",
        sizes: [
          { size: "S", stock: 2 },
          { size: "M", stock: 3 },
          { size: "L", stock: 1 },
        ],
      },
      {
        color: "white",
        sizes: [
          { size: "S", stock: 1 },
          { size: "M", stock: 2 },
        ],
      },
    ],
  } as Product;
}

describe("productVariantPolicy", () => {
  it("requires picker for multi-size clothing", () => {
    expect(productRequiresVariantPicker(clothingProduct(), "clothing")).toBe(true);
  });

  it("allows instant add for single default variant", () => {
    const p = {
      id: 2,
      name: "Напиток",
      price: 100,
      image: "",
      businessType: "coffee",
      sizes: [{ size: "350ml", stock: 5 }],
    } as Product;
    expect(productRequiresVariantPicker(p, "coffee")).toBe(false);
    expect(resolveInstantAddLine(p, "coffee")).toEqual({
      size: "350ml",
      color: "default",
    });
  });
});
