import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

describe("analytics lifetime contracts", () => {
  it("keeps lifetime analytics source in merchant analytics service", () => {
    const src = read("src/server/merchantAnalyticsService.ts");
    expect(src.includes("getMerchantLifetimeAnalytics")).toBe(true);
    expect(src.includes("totalOrders: lifetimeSuccessfulOrders")).toBe(true);
    expect(src.includes("periods")).toBe(true);
    expect(src.includes("topCategories")).toBe(true);
  });

  it("tracks lifetime transitions in order hooks", () => {
    const src = read("src/server/orderInventoryHooks.ts");
    expect(src.includes("applyLifetimeStatusTransition")).toBe(true);
    expect(src.includes("onOrderPaidConfirmed")).toBe(true);
  });

  it("registers lifetime order creation during checkout", () => {
    const src = read("src/server/index.ts");
    expect(src.includes("registerLifetimeOrderCreated")).toBe(true);
    expect(src.includes("registerLifetimeOrderCreated({")).toBe(true);
    expect(src.includes('app.delete("/orders/clear"')).toBe(true);
  });

  it("defines phase14 lifetime analytics models in prisma schema", () => {
    const src = read("prisma/schema.prisma");
    expect(src.includes("model MerchantLifetimeAnalytics")).toBe(true);
    expect(src.includes("model MerchantLifetimeOrderState")).toBe(true);
  });
});
