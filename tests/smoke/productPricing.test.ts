import { describe, expect, it } from "vitest";
import {
  discountPercentFromAttributes,
  effectiveUnitPriceFromProduct,
} from "../../src/shared/productPricing.js";

describe("productPricing", () => {
  it("reads discountPercent from attributes JSON", () => {
    expect(discountPercentFromAttributes({ discountPercent: 15 })).toBe(15);
    expect(discountPercentFromAttributes({})).toBe(0);
  });

  it("effectiveUnitPriceFromProduct applies discount from attributes", () => {
    expect(
      effectiveUnitPriceFromProduct({
        price: 5000,
        attributes: { discountPercent: 10 },
      }),
    ).toBe(4500);
    expect(effectiveUnitPriceFromProduct({ price: 5000, attributes: {} })).toBe(
      5000,
    );
  });
});
