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
    expect(electronics.variantPolicy.primaryAxisKey).toBe("memory");
    expect(electronics.variantPolicy.primaryAxisLabel).toBe("Память");
    expect(electronics.productSchema).toHaveProperty("display");
    expect(electronics.productSchema).toHaveProperty("cpu");

    const autoparts = getBusinessTemplateDescriptor("autoparts");
    expect(autoparts.variantPolicy.mode).toBe("metadata_only");
    expect(autoparts.variantPolicy.showOrderOptionsOnStorefront).toBe(true);
    expect(autoparts.productSchema).toHaveProperty("oem");
    expect(autoparts.productSchema).toHaveProperty("compatibleModels");
    expect(autoparts.orderOptionsSchema).toHaveProperty("vin");
    expect(autoparts.catalogBehavior.cardPlaceholder.length).toBeGreaterThan(0);

    const cosmetics = getBusinessTemplateDescriptor("cosmetics");
    expect(cosmetics.productSchema).toHaveProperty("shade");
    expect(cosmetics.productSchema).toHaveProperty("usageGuide");
    expect(cosmetics.catalogBehavior.imageRatioHint).toBe("portrait");

    const furniture = getBusinessTemplateDescriptor("furniture");
    expect(furniture.productSchema).toHaveProperty("dimensions");
    expect(furniture.productSchema).toHaveProperty("colorFamily");
    expect(furniture.productSchema).toHaveProperty("assemblyRequired");
    expect(furniture.catalogBehavior.imageRatioHint).toBe("landscape");
  });
});

