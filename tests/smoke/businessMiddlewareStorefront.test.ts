import { describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { businessMiddleware } from "../../src/middleware/business.middleware.js";

function mockRes(): Response {
  const res = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json: vi.fn(),
  };
  return res as unknown as Response;
}

describe("businessMiddleware storefront booking bypass", () => {
  it("does not require telegram for GET dining-tables", async () => {
    const req = {
      path: "/api/storefront/42/dining-tables",
      url: "/api/storefront/42/dining-tables",
      headers: {},
    } as Request;
    const res = mockRes();
    let nextCalled = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };
    await businessMiddleware(req, res, next);
    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.json).not.toHaveBeenCalled();
  });

  it("still requires telegram for merchant dining-tables", async () => {
    const req = {
      path: "/api/merchant/dining-tables",
      url: "/api/merchant/dining-tables",
      headers: {},
    } as Request;
    const res = mockRes();
    let nextCalled = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };
    await businessMiddleware(req, res, next);
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });
});
