import { describe, expect, it } from "vitest";
import { BusinessType } from "@prisma/client";
import {
  LEGACY_STALE_PRODUCT_ATTR_KEYS,
  stripProductAttributesToSchema,
} from "../../src/shared/productAttributeNormalization.js";
import { validateProductAttributesForAdmin, validateProductAttributes } from "../../src/server/templateValidation.js";

describe("product attribute normalization", () => {
  const coffeeSchemaKeys = ["hotOrCold", "sugar", "syrups"];

  it("strips clothing legacy keys from coffee attributes", () => {
    const raw = {
      hotOrCold: "hot",
      size: ["S", "M", "L"],
      color: ["black"],
      brand: "Nike",
      volume: "350ml",
      variants: [{ color: "x", sizes: [] }],
    };
    const { value, strippedKeys, staleLegacyKeys } = stripProductAttributesToSchema(
      coffeeSchemaKeys,
      raw,
    );
    expect(value).toEqual({ hotOrCold: "hot" });
    expect(strippedKeys.sort()).toEqual(
      ["brand", "color", "size", "variants", "volume"].sort(),
    );
    expect(staleLegacyKeys).toContain("size");
    expect(staleLegacyKeys).toContain("color");
    expect(staleLegacyKeys).toContain("brand");
    expect(staleLegacyKeys).toContain("volume");
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
        hotOrCold: "hot",
        sugar: "normal",
      });
      expect(result.value).not.toHaveProperty("volume");
      expect(result.value).not.toHaveProperty("size");
      expect(result.value).not.toHaveProperty("color");
      expect(result.value).not.toHaveProperty("bouquetCount");
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
        packaging: "paper",
        freshness: "today",
      });
      expect(result.value).not.toHaveProperty("bouquetCount");
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

  it("keeps fastfood prep time and calories in product schema", () => {
    const result = validateProductAttributesForAdmin(BusinessType.fastfood, {
      preparationTimeMinutes: 18,
      calories: 420,
      spicy: "hot",
      size: ["M"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        preparationTimeMinutes: 18,
        calories: 420,
        spicy: "hot",
      });
      expect(result.value).not.toHaveProperty("size");
    }
  });

  it("keeps electronics structured specs in product schema", () => {
    const result = validateProductAttributesForAdmin(BusinessType.electronics, {
      brand: "Archa",
      display: '6.7" OLED',
      cpu: "Snapdragon",
      ram: "8 GB",
      storage: "256 GB",
      battery: "5000 mAh",
      warranty: "12 месяцев",
      kitContents: "USB-C кабель",
      memory: "128GB",
      specifications: "legacy blob",
      size: ["128GB"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        brand: "Archa",
        display: '6.7" OLED',
        cpu: "Snapdragon",
        ram: "8 GB",
        storage: "256 GB",
        battery: "5000 mAh",
        warranty: "12 месяцев",
        kitContents: "USB-C кабель",
      });
      expect(result.value).not.toHaveProperty("memory");
      expect(result.value).not.toHaveProperty("specifications");
      expect(result.value).not.toHaveProperty("size");
    }
  });

  it("keeps autoparts fitment fields in product schema", () => {
    const result = validateProductAttributesForAdmin(BusinessType.autoparts, {
      brand: "Apex",
      sku: "AX-205",
      oem: "04465-02230",
      compatibleModels: "Toyota Camry",
      modelYear: "2018-2023",
      engine: "2.5L",
      compatibility: "Toyota Camry 2018-2023",
      vin: "SHOULD_STRIP",
      specifications: "legacy",
      model: "Camry",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        brand: "Apex",
        sku: "AX-205",
        oem: "04465-02230",
        compatibleModels: "Toyota Camry",
        modelYear: "2018-2023",
        engine: "2.5L",
        compatibility: "Toyota Camry 2018-2023",
      });
      expect(result.value).not.toHaveProperty("vin");
      expect(result.value).not.toHaveProperty("specifications");
      expect(result.value).not.toHaveProperty("model");
    }
  });

  it("keeps cosmetics shade, ingredients and usageGuide in product schema", () => {
    const result = validateProductAttributesForAdmin(BusinessType.cosmetics, {
      brand: "Archa Beauty",
      shade: "Rose Velvet",
      volume: "30 мл",
      skinType: "dry",
      ingredients: "Aqua, Glycerin",
      usageGuide: "Apply twice daily",
      size: ["30ml"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        brand: "Archa Beauty",
        shade: "Rose Velvet",
        volume: "30 мл",
        skinType: "dry",
        ingredients: "Aqua, Glycerin",
        usageGuide: "Apply twice daily",
      });
      expect(result.value).not.toHaveProperty("size");
    }
  });

  it("keeps furniture dimensions, material, colorFamily and assemblyRequired in product schema", () => {
    const result = validateProductAttributesForAdmin(BusinessType.furniture, {
      material: "Велюр",
      dimensions: "230×95×90 см",
      colorFamily: "Серый",
      assemblyRequired: true,
      warranty: "24 месяца",
      color: "legacy-gray",
      size: ["L"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        material: "Велюр",
        dimensions: "230×95×90 см",
        colorFamily: "Серый",
        assemblyRequired: true,
        warranty: "24 месяца",
      });
      expect(result.value).not.toHaveProperty("color");
      expect(result.value).not.toHaveProperty("size");
    }
  });
});
