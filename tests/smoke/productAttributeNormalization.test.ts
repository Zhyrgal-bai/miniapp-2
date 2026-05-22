import { describe, expect, it } from "vitest";
import { BusinessType } from "@prisma/client";
import {
  LEGACY_STALE_PRODUCT_ATTR_KEYS,
  stripProductAttributesToSchema,
} from "../../src/shared/productAttributeNormalization.js";
import { validateProductAttributesForAdmin, validateProductAttributes } from "../../src/server/templateValidation.js";

describe("product attribute normalization", () => {
  const coffeeSchemaKeys = ["volume", "hotOrCold", "sugar", "syrups"];

  it("strips clothing legacy keys from coffee attributes", () => {
    const raw = {
      volume: "350ml",
      hotOrCold: "hot",
      size: ["S", "M", "L"],
      color: ["black"],
      brand: "Nike",
      variants: [{ color: "x", sizes: [] }],
    };
    const { value, strippedKeys, staleLegacyKeys } = stripProductAttributesToSchema(
      coffeeSchemaKeys,
      raw,
    );
    expect(value).toEqual({ volume: "350ml", hotOrCold: "hot" });
    expect(strippedKeys.sort()).toEqual(
      ["brand", "color", "size", "variants"].sort(),
    );
    expect(staleLegacyKeys).toContain("size");
    expect(staleLegacyKeys).toContain("color");
    expect(staleLegacyKeys).toContain("brand");
  });

  it("documents common stale keys list", () => {
    expect(LEGACY_STALE_PRODUCT_ATTR_KEYS).toContain("bouquetCount");
    expect(LEGACY_STALE_PRODUCT_ATTR_KEYS).toContain("size");
    expect(LEGACY_STALE_PRODUCT_ATTR_KEYS).toContain("volume");
  });

  it("admin validation accepts coffee product migrated from clothing", () => {
    const result = validateProductAttributesForAdmin(BusinessType.coffee, {
      volume: ["350ml", "450ml"],
      hotOrCold: ["hot"],
      size: ["M"],
      color: "black",
      bouquetCount: "21",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        volume: "350ml",
        hotOrCold: "hot",
      });
      expect(result.value).not.toHaveProperty("size");
      expect(result.value).not.toHaveProperty("color");
    }
  });

  it("admin validation keeps flowers schema keys only", () => {
    const result = validateProductAttributesForAdmin(BusinessType.flowers, {
      bouquetCount: "21",
      packaging: "paper",
      size: ["51"],
      volume: "350ml",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        bouquetCount: "21",
        packaging: "paper",
      });
      expect(result.value).not.toHaveProperty("size");
      expect(result.value).not.toHaveProperty("volume");
    }
  });

  it("strict unknown keys path still fails when used directly", () => {
    const strict = validateProductAttributes(BusinessType.coffee, {
      volume: "350ml",
      size: "M",
    });
    expect(strict.ok).toBe(false);
    if (!strict.ok) {
      expect(strict.error).toBe("Есть неизвестные поля");
    }
  });
});
