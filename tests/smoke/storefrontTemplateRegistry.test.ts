import { describe, expect, it } from "vitest";
import {
  resolveCardRendererId,
  resolveCatalogBehavior,
  resolveModalBehavior,
  resolveModalRendererId,
} from "../../frontend/src/storefront/templates/templateRegistry.js";

describe("storefront template registry", () => {
  it("resolves renderer ids by businessType", () => {
    expect(resolveCardRendererId({ businessType: "clothing" })).toBe("clothing");
    expect(resolveCardRendererId({ businessType: "universal" })).toBe("generic");
    expect(resolveModalRendererId({ businessType: "furniture" })).toBe(
      "product-experience-v2",
    );
  });

  it("resolves catalog and modal behavior from payload descriptor", () => {
    const descriptor = {
      businessType: "electronics",
      cardRendererId: "electronics",
      modalRendererId: "product-experience-v2",
      catalogBehavior: {
        cardPlaceholder: "Specs",
        imageRatioHint: "square",
        imageFitHint: "contain",
      },
      modalBehavior: {
        mode: "centered_v2",
        maxWidth: "lg",
        stickyActionBar: true,
      },
    };
    expect(
      resolveCardRendererId({
        businessType: "clothing",
        templateDescriptor: descriptor,
      }),
    ).toBe("electronics");
    expect(
      resolveCatalogBehavior({
        businessType: "clothing",
        templateDescriptor: descriptor,
      }),
    ).toEqual({
      cardPlaceholder: "Specs",
      imageRatioHint: "square",
      imageFitHint: "contain",
    });
    expect(
      resolveModalBehavior({
        businessType: "clothing",
        templateDescriptor: descriptor,
      }).maxWidth,
    ).toBe("lg");
  });
});

