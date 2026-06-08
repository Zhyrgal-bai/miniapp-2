import { describe, expect, it } from "vitest";
import {
  getBusinessTemplateDescriptor,
  listBusinessTemplateDescriptors,
} from "../../src/templates/registry/businessTemplateRegistry.js";

describe("business template registry", () => {
  it("provides descriptor for every vertical", () => {
    const ids = listBusinessTemplateDescriptors().map((d) => d.businessType);
    expect(ids).toContain("universal");
    expect(ids).toContain("clothing");
    expect(ids).toContain("flowers");
    expect(ids).toContain("coffee");
    expect(ids).toContain("fastfood");
    expect(ids).toContain("electronics");
    expect(ids).toContain("autoparts");
    expect(ids).toContain("cosmetics");
    expect(ids).toContain("furniture");
  });

  it("exposes ui/variant policies for new verticals", () => {
    const electronics = getBusinessTemplateDescriptor("electronics");
    expect(electronics.cardRendererId).toBe("electronics");
    expect(electronics.modalRendererId).toBe("product-experience-v2");
    expect(electronics.catalogBehavior.imageFitHint).toBe("contain");

    const autoparts = getBusinessTemplateDescriptor("autoparts");
    expect(autoparts.variantPolicy.mode).toBe("metadata_only");
    expect(autoparts.catalogBehavior.cardPlaceholder.length).toBeGreaterThan(0);
  });
});

