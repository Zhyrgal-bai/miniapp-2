import { describe, expect, it } from "vitest";
import {
  isPublicStorefrontBookingPath,
  storefrontBookingRequiresVerifiedTelegram,
} from "../../src/shared/storefrontPublicPaths.js";
import { routeRequiresVerifiedTelegram } from "../../src/middleware/privilegedRoutes.js";

describe("public storefront table booking paths", () => {
  it("marks dining-tables, reservations, table-qr as public (no tenant middleware)", () => {
    expect(isPublicStorefrontBookingPath("/api/storefront/42/dining-tables")).toBe(
      true,
    );
    expect(
      isPublicStorefrontBookingPath("/api/storefront/42/dining-tables/slots"),
    ).toBe(true);
    expect(
      isPublicStorefrontBookingPath("/api/storefront/7/table-reservations"),
    ).toBe(true);
    expect(isPublicStorefrontBookingPath("/api/storefront/table-qr/abc")).toBe(
      true,
    );
    expect(isPublicStorefrontBookingPath("/api/storefront/42")).toBe(false);
    expect(isPublicStorefrontBookingPath("/api/merchant/dining-tables")).toBe(
      false,
    );
  });

  it("requires verified telegram only for POST reservation and table-qr", () => {
    expect(
      storefrontBookingRequiresVerifiedTelegram(
        "GET",
        "/api/storefront/1/dining-tables",
      ),
    ).toBe(false);
    expect(
      storefrontBookingRequiresVerifiedTelegram(
        "POST",
        "/api/storefront/1/table-reservations",
      ),
    ).toBe(true);
    expect(
      storefrontBookingRequiresVerifiedTelegram(
        "GET",
        "/api/storefront/table-qr/tok",
      ),
    ).toBe(true);
  });

  it("routeRequiresVerifiedTelegram: GET dining-tables is public", () => {
    const req = {
      method: "GET",
      path: "/api/storefront/99/dining-tables",
      url: "/api/storefront/99/dining-tables",
    } as import("express").Request;
    expect(routeRequiresVerifiedTelegram(req)).toBe(false);
  });

  it("routeRequiresVerifiedTelegram: POST table-reservations needs initData", () => {
    const req = {
      method: "POST",
      path: "/api/storefront/99/table-reservations",
      url: "/api/storefront/99/table-reservations",
    } as import("express").Request;
    expect(routeRequiresVerifiedTelegram(req)).toBe(true);
  });
});
