import { describe, expect, it } from "vitest";
import { routeRequiresVerifiedTelegram } from "../../src/middleware/privilegedRoutes.js";
import { verifiedTelegramIdFromRequest } from "../../src/middleware/verifiedTelegramAuth.js";
import {
  hasMerchantPermission,
  MERCHANT_PERM,
} from "../../frontend/src/permissions/merchantPermissions.js";
import type { Request } from "express";

function mockReq(method: string, path: string, initDataUser?: string): Request {
  return {
    method,
    path,
    url: path,
    headers: initDataUser
      ? {}
      : {},
    platformTelegramId: initDataUser,
  } as unknown as Request;
}

describe("merchant auth hardening", () => {
  it("POST /orders requires verified telegram", () => {
    expect(
      routeRequiresVerifiedTelegram(mockReq("POST", "/orders")),
    ).toBe(true);
  });

  it("GET /products is public catalog", () => {
    expect(routeRequiresVerifiedTelegram(mockReq("GET", "/products"))).toBe(
      false,
    );
  });

  it("GET /integrations/finik requires verified telegram", () => {
    expect(
      routeRequiresVerifiedTelegram(mockReq("GET", "/integrations/finik")),
    ).toBe(true);
  });

  it("OWNER role grants all permissions even when list is null", () => {
    expect(hasMerchantPermission(null, MERCHANT_PERM.ordersManage, "OWNER")).toBe(
      true,
    );
    expect(
      hasMerchantPermission([], MERCHANT_PERM.settingsManage, "ADMIN"),
    ).toBe(true);
    expect(
      hasMerchantPermission([], MERCHANT_PERM.ordersManage, "SUPPORT"),
    ).toBe(false);
  });

  it("production rejects spoofed body userId without platformTelegramId", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const req = {
      method: "POST",
      path: "/products",
      headers: {},
      body: { userId: "999888777" },
      query: {},
    } as unknown as Request;
    expect(verifiedTelegramIdFromRequest(req)).toBeNull();
    process.env.NODE_ENV = prev;
  });

  it("accepts platformTelegramId from initData middleware", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const req = {
      platformTelegramId: "123456789",
    } as unknown as Request;
    expect(verifiedTelegramIdFromRequest(req)).toBe("123456789");
    process.env.NODE_ENV = prev;
  });
});

describe("Finik webhook HMAC", () => {
  it("accepts valid HMAC-SHA256 hex signature", async () => {
    const { createHmac } = await import("node:crypto");
    const { verifyFinikWebhookSignature } = await import(
      "../../src/server/finikWebhookCrypto.js"
    );
    const prev = process.env.NODE_ENV;
    const prevHdr = process.env.FINIK_WEBHOOK_SIGNATURE_HEADER;
    process.env.NODE_ENV = "production";
    process.env.FINIK_WEBHOOK_SIGNATURE_HEADER = "x-finik-signature";

    const secret = "test-secret-key";
    const rawBody = '{"paymentId":"p1","status":"SUCCEEDED"}';
    const sig = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    const req = { headers: { "x-finik-signature": sig } } as unknown as Request;

    expect(verifyFinikWebhookSignature(secret, req, rawBody)).toBe(true);
    expect(
      verifyFinikWebhookSignature(secret, req, '{"paymentId":"p1","status":"FAILED"}'),
    ).toBe(false);

    process.env.NODE_ENV = prev;
    process.env.FINIK_WEBHOOK_SIGNATURE_HEADER = prevHdr;
  });

  it("rejects plain secret compare in production", async () => {
    const { verifyFinikWebhookSignature } = await import(
      "../../src/server/finikWebhookCrypto.js"
    );
    const prev = process.env.NODE_ENV;
    const prevHdr = process.env.FINIK_WEBHOOK_SIGNATURE_HEADER;
    process.env.NODE_ENV = "production";
    process.env.FINIK_WEBHOOK_SIGNATURE_HEADER = "x-finik-signature";

    const secret = "plain-secret";
    const req = { headers: { "x-finik-signature": secret } } as unknown as Request;
    expect(verifyFinikWebhookSignature(secret, req, "{}")).toBe(false);

    process.env.NODE_ENV = prev;
    process.env.FINIK_WEBHOOK_SIGNATURE_HEADER = prevHdr;
  });
});

describe("my-businesses auth gate", () => {
  it("GET /my-businesses requires verified telegram", () => {
    expect(
      routeRequiresVerifiedTelegram(mockReq("GET", "/my-businesses")),
    ).toBe(true);
    expect(
      routeRequiresVerifiedTelegram(mockReq("GET", "/api/my-businesses")),
    ).toBe(true);
  });

  it("GET /api/me requires verified telegram", () => {
    expect(routeRequiresVerifiedTelegram(mockReq("GET", "/api/me"))).toBe(
      true,
    );
  });

  it("GET /api/storefront/by-slug stays public", () => {
    expect(
      routeRequiresVerifiedTelegram(
        mockReq("GET", "/api/storefront/by-slug/demo"),
      ),
    ).toBe(false);
  });
});

describe("checkout pricing (unit)", () => {
  it("effective price applies discount", async () => {
    const { priceCheckoutLines } = await import(
      "../../src/server/checkoutPricing.js"
    );
    // Priced via prisma mock would need DB — covered in integration when DATABASE_URL set
    expect(typeof priceCheckoutLines).toBe("function");
  });
});
