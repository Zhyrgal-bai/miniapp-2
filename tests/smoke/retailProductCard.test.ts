import { describe, expect, it } from "vitest";
import {
  formatRetailCardPrice,
  retailCardAspectRatio,
  RETAIL_CARD_ACTION_MIN_PX,
} from "../../frontend/src/storefront/retailProductCard";

describe("retailProductCard", () => {
  it("uses 44px minimum action height", () => {
    expect(RETAIL_CARD_ACTION_MIN_PX).toBe(44);
  });

  it("maps image ratios to CSS aspect-ratio strings", () => {
    expect(retailCardAspectRatio("square")).toBe("1 / 1");
    expect(retailCardAspectRatio("portrait")).toBe("4 / 5");
    expect(retailCardAspectRatio("landscape")).toBe("16 / 10");
  });

  it("formats price with som suffix", () => {
    expect(formatRetailCardPrice(1990)).toBe("1990 сом");
  });
});
