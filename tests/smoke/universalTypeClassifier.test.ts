import { describe, expect, it } from "vitest";
import { classifyUniversalBusiness } from "../../src/server/migrations/universalTypeClassifier.js";

describe("universal type classifier", () => {
  it("routes vin/compatibility-heavy stores to autoparts", () => {
    const out = classifyUniversalBusiness({
      merchantConfig: { enableVin: true, enableCompatibility: true },
      productSignals: {
        total: 10,
        withVin: 6,
        withCompatibility: 7,
        withSpecifications: 0,
        withIngredients: 0,
        withDimensions: 0,
        withVolume: 0,
      },
    });
    expect(out.proposedType).toBe("autoparts");
    expect(out.confidence).not.toBe("low");
  });

  it("routes ingredient-heavy stores to cosmetics", () => {
    const out = classifyUniversalBusiness({
      merchantConfig: { enableVolume: true },
      productSignals: {
        total: 8,
        withVin: 0,
        withCompatibility: 0,
        withSpecifications: 1,
        withIngredients: 6,
        withDimensions: 0,
        withVolume: 5,
      },
    });
    expect(out.proposedType).toBe("cosmetics");
  });
});

