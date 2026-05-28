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

/** Simulates req inside app.use("/api", businessMiddleware). */
function mountedReq(path: string): Request {
  return {
    path,
    url: path,
    originalUrl: `/api${path}`,
    baseUrl: "/api",
    headers: {},
  } as Request;
}

describe("businessMiddleware storefront booking bypass", () => {
  it("does not require telegram for GET dining-tables (mounted path)", async () => {
    const req = mountedReq("/storefront/42/dining-tables");
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

  it("does not require telegram for GET dining-tables slots (mounted path)", async () => {
    const req = mountedReq("/storefront/42/dining-tables/slots");
    const res = mockRes();
    let nextCalled = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };
    await businessMiddleware(req, res, next);
    expect(nextCalled).toBe(true);
    expect(res.json).not.toHaveBeenCalled();
  });

  it("does not require staff auth for POST table-reservations (mounted path)", async () => {
    const req = mountedReq("/storefront/42/table-reservations");
    const res = mockRes();
    let nextCalled = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };
    await businessMiddleware(req, res, next);
    expect(nextCalled).toBe(true);
    expect(res.json).not.toHaveBeenCalled();
  });

  it("still requires telegram for merchant dining-tables (mounted path)", async () => {
    const req = mountedReq("/merchant/dining-tables");
    const res = mockRes();
    let nextCalled = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };
    await businessMiddleware(req, res, next);
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it("still requires telegram for merchant venue floor (mounted path)", async () => {
    const req = mountedReq("/merchant/venue/floor");
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
