import { describe, expect, it } from "vitest";
import {
  hasVerticalMarketingPresets,
  verticalMarketingPresets,
} from "../../src/shared/verticalMarketingPresets.js";
import { TARGET_BUSINESS_TYPE_IDS } from "../../src/shared/businessTypes.js";
import { PROMOTION_TYPES } from "../../src/shared/promotionEngine.js";

describe("verticalMarketingPresets", () => {
  it("provides presets for all 8 target verticals", () => {
    for (const type of TARGET_BUSINESS_TYPE_IDS) {
      expect(hasVerticalMarketingPresets(type)).toBe(true);
      const presets = verticalMarketingPresets(type);
      expect(presets.length).toBeGreaterThan(0);
      for (const p of presets) {
        expect(PROMOTION_TYPES).toContain(p.promotionType);
        expect(p.title.trim()).not.toBe("");
      }
    }
  });

  it("falls back for unknown vertical", () => {
    const presets = verticalMarketingPresets("nonexistent");
    expect(presets.length).toBeGreaterThan(0);
  });
});
