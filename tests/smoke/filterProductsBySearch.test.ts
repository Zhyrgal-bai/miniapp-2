import { describe, expect, it } from "vitest";
import { filterProductsBySearch } from "../../frontend/src/utils/filterProductsBySearch";
import type { Product } from "../../frontend/src/types";

const sample: Product[] = [
  { id: 1, name: "Капучино", price: 120, categoryId: 1 } as Product,
  { id: 2, name: "Латте", price: 140, categoryId: 1 } as Product,
  { id: 3, name: "Чизкейк", price: 220, categoryId: 2 } as Product,
];

describe("filterProductsBySearch", () => {
  it("returns all products for empty query", () => {
    expect(filterProductsBySearch(sample, "")).toHaveLength(3);
  });

  it("filters by product name", () => {
    expect(filterProductsBySearch(sample, "латте")).toEqual([sample[1]]);
  });

  it("is case insensitive", () => {
    expect(filterProductsBySearch(sample, "КАПУ")).toEqual([sample[0]]);
  });
});
