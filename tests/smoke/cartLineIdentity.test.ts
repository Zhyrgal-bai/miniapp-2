import { describe, expect, it } from "vitest";
import { findCartLineForSelection } from "../../frontend/src/commerce/cartLineIdentity.ts";

describe("findCartLineForSelection", () => {
  const items = [
    {
      productId: 10,
      size: "XL",
      color: "красный",
      name: "Batnik",
      price: 1799,
      quantity: 2,
    },
  ];

  it("returns exact variant line only (no product-wide fallback)", () => {
    expect(
      findCartLineForSelection(items, {
        productId: 10,
        size: "S",
        storageColor: "красный",
        needsVariantPicker: true,
        businessType: "clothing",
      }),
    ).toBeNull();

    expect(
      findCartLineForSelection(items, {
        productId: 10,
        size: "XL",
        storageColor: "красный",
        needsVariantPicker: true,
        businessType: "clothing",
      })?.quantity,
    ).toBe(2);
  });
});
