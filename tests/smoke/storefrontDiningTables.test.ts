import { describe, expect, it } from "vitest";
import {
  isPublicStorefrontBookingPath,
  normalizeStorefrontApiPath,
  storefrontBookingRequiresVerifiedTelegram,
  storefrontReservationGuestRequiresVerifiedTelegram,
} from "../../src/shared/storefrontPublicPaths.js";
import { routeRequiresVerifiedTelegram } from "../../src/middleware/privilegedRoutes.js";

describe("public storefront table booking paths", () => {
  it("normalizeStorefrontApiPath strips /api mount prefix", () => {
    expect(normalizeStorefrontApiPath("/api/storefront/42/dining-tables")).toBe(
      "/storefront/42/dining-tables",
    );
    expect(normalizeStorefrontApiPath("/storefront/42/dining-tables")).toBe(
      "/storefront/42/dining-tables",
    );
  });

  it("marks dining-tables, reservations, table-qr as public (full and mounted paths)", () => {
    for (const path of [
      "/api/storefront/42/dining-tables",
      "/storefront/42/dining-tables",
      "/api/storefront/42/dining-tables/slots",
      "/storefront/42/dining-tables/slots",
      "/api/storefront/7/table-reservations",
      "/storefront/7/table-reservations",
      "/api/storefront/table-qr/abc",
      "/storefront/table-qr/abc",
    ]) {
      expect(isPublicStorefrontBookingPath(path), path).toBe(true);
    }
    expect(isPublicStorefrontBookingPath("/api/storefront/42")).toBe(false);
    expect(isPublicStorefrontBookingPath("/storefront/42")).toBe(false);
    expect(isPublicStorefrontBookingPath("/api/merchant/dining-tables")).toBe(false);
    expect(isPublicStorefrontBookingPath("/merchant/dining-tables")).toBe(false);
  });

  it("requires verified telegram only for POST reservation and table-qr", () => {
    expect(
      storefrontBookingRequiresVerifiedTelegram(
        "GET",
        "/storefront/1/dining-tables",
      ),
    ).toBe(false);
    expect(
      storefrontBookingRequiresVerifiedTelegram(
        "POST",
        "/storefront/1/table-reservations",
      ),
    ).toBe(true);
    expect(
      storefrontBookingRequiresVerifiedTelegram(
        "GET",
        "/storefront/table-qr/tok",
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

  it("requires verified telegram for guest reservation GET APIs", () => {
    expect(
      storefrontReservationGuestRequiresVerifiedTelegram(
        "GET",
        "/storefront/1/table-reservations/mine",
      ),
    ).toBe(true);
    expect(
      storefrontReservationGuestRequiresVerifiedTelegram(
        "GET",
        "/storefront/1/table-reservations/42/preorder-context",
      ),
    ).toBe(true);
  });
});
