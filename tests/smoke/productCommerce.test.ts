import { describe, expect, it } from "vitest";
import {
  findStockConsistencyIssues,
  resolvePublicVariants,
  sumPublicVariantStock,
} from "../../src/shared/stockResolver.js";
import { toPublicProduct } from "../../src/shared/productDto.js";
import { isOutOfStock } from "../../frontend/src/utils/product.ts";

describe("product DTO and stock (ProductStock source of truth)", () => {
  it("uses ProductStock.available not attributes.variants stock", () => {
    const dto = toPublicProduct(
      {
        id: 1,
        name: "Test",
        price: 100,
        image: "x.jpg",
        attributes: {
          variants: [{ color: "Black", sizes: [{ size: "M", stock: 99 }] }],
        },
      },
      {
        businessType: "clothing",
        stockRows: [{ size: "M", color: "Black", available: 2 }],
      },
    );
    expect(dto.totalAvailable).toBe(2);
    expect(dto.variants[0]?.sizes[0]?.stock).toBe(2);
  });

  it("zero ProductStock means out of stock even if attributes show stock", () => {
    const dto = toPublicProduct(
      {
        id: 2,
        name: "Empty",
        price: 50,
        image: "y.jpg",
        attributes: {
          variants: [{ color: "", sizes: [{ size: "350ml", stock: 10 }] }],
        },
      },
      {
        businessType: "coffee",
        stockRows: [{ size: "350ml", color: "", available: 0 }],
      },
    );
    expect(dto.totalAvailable).toBe(0);
    expect(
      isOutOfStock({
        id: 2,
        name: "Empty",
        price: 50,
        image: "y.jpg",
        variants: dto.variants,
        totalAvailable: dto.totalAvailable,
      }),
    ).toBe(true);
  });

  it("detects catalog vs ProductStock mismatch", () => {
    const issues = findStockConsistencyIssues({
      catalogVariantsRaw: [
        { color: "Black", sizes: [{ size: "M", stock: 5 }] },
      ],
      stockRows: [{ size: "M", color: "Black", available: 3 }],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.catalogStock).toBe(5);
    expect(issues[0]?.productStockAvailable).toBe(3);
  });

  it("builds variants from stock rows when catalog empty", () => {
    const variants = resolvePublicVariants({
      businessType: "flowers",
      catalogShapes: [],
      stockRows: [
        { size: "21", color: "", available: 4 },
        { size: "51", color: "", available: 0 },
      ],
    });
    expect(sumPublicVariantStock(variants)).toBe(4);
  });
});
