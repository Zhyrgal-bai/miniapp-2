import { describe, expect, it } from "vitest";
import {
  isLegacyTechnicalSlug,
  slugifyStoreName,
} from "../../src/shared/storeSlug.js";

describe("isLegacyTechnicalSlug", () => {
  it("treats null/empty as legacy technical", () => {
    expect(isLegacyTechnicalSlug(null)).toBe(true);
    expect(isLegacyTechnicalSlug(undefined)).toBe(true);
    expect(isLegacyTechnicalSlug("")).toBe(true);
    expect(isLegacyTechnicalSlug("   ")).toBe(true);
  });

  it("treats shop-* prefixes as legacy technical", () => {
    expect(isLegacyTechnicalSlug("shop-m5xk2abc")).toBe(true);
    expect(isLegacyTechnicalSlug("shop-4-mq16mudk")).toBe(true);
  });

  it("treats base36 timestamp suffix fallbacks as legacy technical", () => {
    expect(isLegacyTechnicalSlug("bars-m5xk2ab")).toBe(true);
    expect(isLegacyTechnicalSlug("kofeynya-l7k3m9x0")).toBe(true);
  });

  it("keeps human-looking slugs", () => {
    expect(isLegacyTechnicalSlug("nur-market")).toBe(false);
    expect(isLegacyTechnicalSlug("100-roz")).toBe(false);
    expect(isLegacyTechnicalSlug("nur-market-2")).toBe(false);
    expect(isLegacyTechnicalSlug("cupcoffee")).toBe(false);
  });
});

describe("slug backfill name → slug derivation", () => {
  it("transliterates cyrillic and numeric store names", () => {
    expect(slugifyStoreName("100 роз")).toBe("100-roz");
    expect(slugifyStoreName("«100 роз»")).toBe("100-roz");
    expect(slugifyStoreName("Кофейня")).toBe("kofeynya");
  });

  it("preserves existing slugifyStoreName behavior", () => {
    expect(slugifyStoreName("Nur Market")).toBe("nur-market");
    expect(slugifyStoreName("BARS")).toBe("bars");
  });
});
