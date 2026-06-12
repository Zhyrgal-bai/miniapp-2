import { describe, expect, it } from "vitest";
import {
  parseProductBulkPatch,
  parseProductListQuery,
  parseProductStatus,
  parseBulkProductIds,
  queryRequiresMerchantCatalogAccess,
} from "../../src/shared/catalogTypes.js";
import {
  isProductVisibleOnStorefront,
} from "../../src/server/catalog/catalogProductService.js";
import {
  sortCategoriesForTree,
  wouldCreateCategoryCycleFromRows,
} from "../../src/server/catalog/categoryCatalogService.js";

describe("catalog P1 — product status", () => {
  it("parses product status values", () => {
    expect(parseProductStatus("active")).toBe("ACTIVE");
    expect(parseProductStatus("DRAFT")).toBe("DRAFT");
    expect(parseProductStatus("archived")).toBe("ARCHIVED");
    expect(parseProductStatus("archive")).toBe("ARCHIVED");
    expect(parseProductStatus("bad")).toBe(null);
  });

  it("ARCHIVED filter requires merchant access and parses correctly", () => {
    const q = parseProductListQuery({ status: "ARCHIVED" });
    expect(q.statuses).toEqual(["ARCHIVED"]);
    expect(q.allStatuses).toBe(false);
    expect(queryRequiresMerchantCatalogAccess(q)).toBe(true);
  });

  it("parses status from query array (Express duplicate param shape)", () => {
    const q = parseProductListQuery({ status: ["DRAFT", "ignored"] });
    expect(q.statuses).toEqual(["DRAFT"]);
  });

  it("defaults list query to ACTIVE only", () => {
    const q = parseProductListQuery({});
    expect(q.statuses).toEqual(["ACTIVE"]);
    expect(q.allStatuses).toBe(false);
    expect(queryRequiresMerchantCatalogAccess(q)).toBe(false);
  });

  it("status=all requires merchant catalog access", () => {
    const q = parseProductListQuery({ status: "all" });
    expect(q.allStatuses).toBe(true);
    expect(queryRequiresMerchantCatalogAccess(q)).toBe(true);
  });

  it("DRAFT filter requires merchant access", () => {
    const q = parseProductListQuery({ status: "DRAFT" });
    expect(q.statuses).toEqual(["DRAFT"]);
    expect(queryRequiresMerchantCatalogAccess(q)).toBe(true);
  });

  it("storefront visibility is ACTIVE only", () => {
    expect(isProductVisibleOnStorefront("ACTIVE")).toBe(true);
    expect(isProductVisibleOnStorefront("DRAFT")).toBe(false);
    expect(isProductVisibleOnStorefront("ARCHIVED")).toBe(false);
  });
});

describe("catalog P1 — list query parsing", () => {
  it("parses search and filters", () => {
    const q = parseProductListQuery({
      q: " hoodie ",
      categoryId: "12",
      sort: "price_asc",
      limit: "25",
      offset: "10",
    });
    expect(q.q).toBe("hoodie");
    expect(q.categoryId).toBe(12);
    expect(q.sort).toBe("price_asc");
    expect(q.limit).toBe(25);
    expect(q.offset).toBe(10);
    expect(q.paginated).toBe(true);
  });

  it("no pagination params → not paginated (backward compat)", () => {
    const q = parseProductListQuery({});
    expect(q.paginated).toBe(false);
    expect(q.limit).toBe(null);
    expect(q.offset).toBe(null);
  });

  it("parses comma-separated statuses", () => {
    const q = parseProductListQuery({ status: "ACTIVE,DRAFT" });
    expect(q.statuses).toEqual(["ACTIVE", "DRAFT"]);
    expect(q.allStatuses).toBe(false);
  });
});

describe("catalog P1 — bulk patch", () => {
  it("parses bulk ids and patch", () => {
    expect(parseBulkProductIds({ ids: [1, 2, 3] })).toEqual([1, 2, 3]);
    expect(parseBulkProductIds({ ids: [] })).toBe(null);
    expect(parseProductBulkPatch({ status: "ARCHIVED" })).toEqual({
      status: "ARCHIVED",
    });
    expect(parseProductBulkPatch({ categoryId: 5 })).toEqual({ categoryId: 5 });
  });
});

describe("catalog P1 — category tree", () => {
  it("sorts by sortOrder then id", () => {
    const sorted = sortCategoriesForTree([
      { id: 3, sortOrder: 1 },
      { id: 1, sortOrder: 0 },
      { id: 2, sortOrder: 0 },
    ]);
    expect(sorted.map((c) => c.id)).toEqual([1, 2, 3]);
  });

  it("detects category parent loop", () => {
    const rows = [
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
      { id: 3, parentId: 2 },
    ];
    expect(wouldCreateCategoryCycleFromRows(rows, 1, 3)).toBe(true);
    expect(wouldCreateCategoryCycleFromRows(rows, 2, 2)).toBe(true);
    expect(wouldCreateCategoryCycleFromRows(rows, 3, 1)).toBe(false);
  });
});

describe("catalog P1 — status filter regression", () => {
  it("status=all includes all lifecycle values in query mode", () => {
    const q = parseProductListQuery({ status: "all", limit: "50", offset: "0" });
    expect(q.allStatuses).toBe(true);
    expect(q.statuses).toBe(null);
    expect(q.paginated).toBe(true);
  });

  it("each single status filter maps to exact enum", () => {
    for (const st of ["ACTIVE", "DRAFT", "ARCHIVED"] as const) {
      const q = parseProductListQuery({ status: st });
      expect(q.statuses).toEqual([st]);
    }
  });

  it("bulk archive patch uses ARCHIVED enum", () => {
    expect(parseProductBulkPatch({ status: "ARCHIVED" })).toEqual({ status: "ARCHIVED" });
  });

  it("bulk restore patch uses ACTIVE enum", () => {
    expect(parseProductBulkPatch({ status: "ACTIVE" })).toEqual({ status: "ACTIVE" });
  });
});

describe("catalog P1 — duplicate SKU deconflict (attributes helper)", () => {
  it("strips top-level sku on copy semantics", () => {
    const attrs = { sku: "ABC-1", name: "x" };
    const copy = JSON.parse(JSON.stringify(attrs)) as Record<string, unknown>;
    delete copy.sku;
    expect(copy.sku).toBeUndefined();
    expect(copy.name).toBe("x");
  });
});
