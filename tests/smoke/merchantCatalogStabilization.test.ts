import { describe, expect, it } from "vitest";
import {
  parseProductListQuery,
  queryRequiresMerchantCatalogAccess,
} from "../../src/shared/catalogTypes.js";
import { routeRequiresVerifiedTelegram } from "../../src/middleware/privilegedRoutes.js";
import { verifiedTelegramIdFromRequest } from "../../src/middleware/verifiedTelegramAuth.js";
import type { Request } from "express";

function mockGetProductsReq(query: Record<string, string>): Request {
  return {
    method: "GET",
    path: "/products",
    url: "/products",
    query,
    headers: {
      "x-telegram-init-data":
        "user=%7B%22id%22%3A123%7D&auth_date=1700000000&hash=abc",
    },
  } as unknown as Request;
}

describe("merchant catalog stabilization — auth gate alignment", () => {
  it("AdminProductManagePage default query (status=all + pagination) requires merchant access", () => {
    const q = parseProductListQuery({
      status: "all",
      limit: "200",
      offset: "0",
      sort: "newest",
    });
    expect(q.allStatuses).toBe(true);
    expect(queryRequiresMerchantCatalogAccess(q)).toBe(true);
  });

  it("storefront default query stays public (ACTIVE only, no pagination params)", () => {
    const q = parseProductListQuery({});
    expect(queryRequiresMerchantCatalogAccess(q)).toBe(false);
    expect(routeRequiresVerifiedTelegram(mockGetProductsReq({}))).toBe(false);
  });

  it("merchant status filters route through verified telegram middleware", () => {
    expect(
      routeRequiresVerifiedTelegram(
        mockGetProductsReq({ status: "all", limit: "200", offset: "0" }),
      ),
    ).toBe(true);
    expect(
      routeRequiresVerifiedTelegram(mockGetProductsReq({ status: "ARCHIVED" })),
    ).toBe(true);
    expect(
      routeRequiresVerifiedTelegram(mockGetProductsReq({ status: "DRAFT" })),
    ).toBe(true);
    expect(
      routeRequiresVerifiedTelegram(mockGetProductsReq({ status: "ACTIVE" })),
    ).toBe(false);
  });

  it("production rejects initData header without verified middleware (regression guard)", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const req = mockGetProductsReq({ status: "all" });
      expect(verifiedTelegramIdFromRequest(req)).toBe(null);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});

describe("merchant catalog stabilization — status enum parity", () => {
  it("frontend filter values match backend parser", () => {
    for (const st of ["all", "ACTIVE", "DRAFT", "ARCHIVED"] as const) {
      const q = parseProductListQuery({ status: st, limit: "50", offset: "0" });
      if (st === "all") {
        expect(q.allStatuses).toBe(true);
      } else {
        expect(q.statuses).toEqual([st]);
      }
    }
  });
});
