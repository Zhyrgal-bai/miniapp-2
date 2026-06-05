import { describe, expect, it } from "vitest";
import { slugifyStoreName } from "../../src/shared/storeSlug.js";

describe("slugifyStoreName", () => {
  it("lowercases latin names without splitting camelCase", () => {
    expect(slugifyStoreName("CupCoffee")).toBe("cupcoffee");
    expect(slugifyStoreName("BARS")).toBe("bars");
  });

  it("joins words with hyphens", () => {
    expect(slugifyStoreName("Nur Market")).toBe("nur-market");
    expect(slugifyStoreName("Alfa Fashion")).toBe("alfa-fashion");
  });

  it("transliterates cyrillic", () => {
    expect(slugifyStoreName("Кофейня")).toBe("kofeynya");
    expect(slugifyStoreName("Нур Маркет")).toBe("nur-market");
  });

  it("trims and collapses punctuation", () => {
    expect(slugifyStoreName("  Bars!!!  ")).toBe("bars");
    expect(slugifyStoreName("A--B")).toBe("a-b");
  });

  it("returns empty for too-short result", () => {
    expect(slugifyStoreName("A")).toBe("");
    expect(slugifyStoreName("!!!")).toBe("");
  });
});
