import { describe, expect, it } from "vitest";
import {
  RESERVED_STORE_SLUGS,
  slugifyStoreName,
  validateMerchantSlug,
} from "../../src/shared/storeSlug.js";

describe("merchant slug", () => {
  it("transliterates and slugifies store names", () => {
    expect(slugifyStoreName("Nur Market")).toBe("nur-market");
    expect(slugifyStoreName("БARS")).toBe("bars");
    expect(slugifyStoreName("  Кофе  Хаус ")).toBe("kofe-haus");
  });

  it("accepts a valid latin slug", () => {
    const r = validateMerchantSlug("My-Store");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slug).toBe("my-store");
  });

  it("rejects too-short slugs", () => {
    expect(validateMerchantSlug("a").ok).toBe(false);
  });

  it("rejects non-latin / invalid characters", () => {
    const r = validateMerchantSlug("кафе");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("INVALID_CHARS");
  });

  it("rejects reserved slugs", () => {
    for (const reserved of ["admin", "api", "merchant", "store"]) {
      expect(RESERVED_STORE_SLUGS.has(reserved)).toBe(true);
      const r = validateMerchantSlug(reserved);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("RESERVED");
    }
  });

  it("normalizes spaces and dedupes hyphens", () => {
    const r = validateMerchantSlug("  cool   shop  ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slug).toBe("cool-shop");
  });
});
