import { describe, expect, it } from "vitest";
import { buildTemplateRegistryDescriptor } from "../../src/server/templateValidation.js";

describe("template descriptor bridge", () => {
  it("returns ui registry ids for target verticals", () => {
    const d = buildTemplateRegistryDescriptor("electronics" as any);
    expect(d.businessType).toBe("electronics");
    expect(d.cardRendererId).toBe("electronics");
    expect(d.modalRendererId).toBe("product-experience-v2");
    expect(typeof d.variantPolicy).toBe("object");
  });
});

