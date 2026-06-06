import { describe, expect, it } from "vitest";
import { BusinessType } from "@prisma/client";
import { isKnownBusinessType, verticalProfileFor } from "../../src/shared/businessCommerce.js";
import {
  filterUniversalProductSchema,
  resolveUniversalVerticalProfile,
} from "../../src/shared/universalCommerce.js";
import { isBusinessTypeId, normalizeProvisionBusinessType } from "../../src/shared/businessTypes.js";
import { templateForBusinessType } from "../../src/templates/index.js";
import { validateProductAttributesForAdmin } from "../../src/server/templateValidation.js";

describe("universal commerce template", () => {
  it("registers universal in known business types", () => {
    expect(isKnownBusinessType("universal")).toBe(true);
    expect(isBusinessTypeId("universal")).toBe(true);
  });

  it("loads universal template with product and merchant settings schemas", () => {
    const tpl = templateForBusinessType("universal");
    expect(tpl.businessType).toBe(BusinessType.universal);
    expect(tpl.productSchema.sku).toBeDefined();
    expect(tpl.merchantSettingsSchema.enableSizes).toBeDefined();
    expect(tpl.demoProducts.length).toBeGreaterThan(0);
  });

  it("filters product schema by merchant toggles", () => {
    const full = templateForBusinessType("universal").productSchema;
    const filtered = filterUniversalProductSchema(full, {
      enableSku: true,
      enableBrand: true,
    });
    expect(Object.keys(filtered).sort()).toEqual(["brand", "sku"]);
  });

  it("resolves variant editor from merchant config", () => {
    const none = resolveUniversalVerticalProfile({ enableSku: true });
    expect(none.variantEditor).toBe("none");

    const sizes = resolveUniversalVerticalProfile({ enableSizes: true });
    expect(sizes.variantEditor).toBe("tier_stock");
    expect(sizes.primaryAxisLabel).toBe("Размер");

    const matrix = resolveUniversalVerticalProfile({
      enableSizes: true,
      enableColors: true,
    });
    expect(matrix.variantEditor).toBe("clothing_matrix");
    expect(matrix.secondaryAxisKey).toBe("color");
  });

  it("verticalProfileFor universal respects merchant config", () => {
    const profile = verticalProfileFor("universal", { enableVariants: true });
    expect(profile.variantEditor).toBe("tier_stock");
  });

  it("validates universal product attributes against enabled fields only", () => {
    const result = validateProductAttributesForAdmin(
      BusinessType.universal,
      { sku: "ABC-1", brand: "Acme", staleKey: "x" },
      undefined,
      { enableSku: true },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sku).toBe("ABC-1");
      expect(result.value.brand).toBeUndefined();
    }
  });

  it("normalizeProvisionBusinessType keeps legacy fallback", () => {
    expect(normalizeProvisionBusinessType("universal")).toBe("universal");
    expect(normalizeProvisionBusinessType("unknown")).toBe("clothing");
  });
});
