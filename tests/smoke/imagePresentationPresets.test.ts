import { describe, expect, it } from "vitest";
import {
  applyImagePresentationForBusinessType,
  imagePresentationForBusinessType,
} from "../../frontend/src/storefront/imagePresentationPresets.js";

describe("imagePresentationForBusinessType", () => {
  it("fashion/clothing → 4:5 cover", () => {
    expect(imagePresentationForBusinessType("clothing")).toEqual({
      imageRatio: "portrait",
      imageFit: "cover",
    });
  });

  it("flowers → 4:5 cover", () => {
    expect(imagePresentationForBusinessType("flowers")).toEqual({
      imageRatio: "portrait",
      imageFit: "cover",
    });
  });

  it("food → 1:1 cover", () => {
    expect(imagePresentationForBusinessType("coffee")).toEqual({
      imageRatio: "square",
      imageFit: "cover",
    });
    expect(imagePresentationForBusinessType("fastfood")).toEqual({
      imageRatio: "square",
      imageFit: "cover",
    });
  });

  it("universal (electronics/autoparts) → contain", () => {
    expect(imagePresentationForBusinessType("universal")).toEqual({
      imageRatio: "square",
      imageFit: "contain",
    });
  });
});

describe("applyImagePresentationForBusinessType", () => {
  it("fills missing fields from business type after preset", () => {
    const out = applyImagePresentationForBusinessType(
      { imageRatio: "square", imageFit: "cover" },
      "clothing",
      {},
    );
    expect(out.imageRatio).toBe("portrait");
    expect(out.imageFit).toBe("cover");
  });

  it("respects explicit merchant imageRatio/imageFit in raw config", () => {
    const out = applyImagePresentationForBusinessType(
      { imageRatio: "square", imageFit: "contain" },
      "clothing",
      { imageRatio: "landscape", imageFit: "cover" },
    );
    expect(out.imageRatio).toBe("landscape");
    expect(out.imageFit).toBe("cover");
  });
});
