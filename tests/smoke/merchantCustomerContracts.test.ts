import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

describe("merchant CRM contracts", () => {
  it("exposes CRM service functions", () => {
    const src = read("src/server/merchantCustomerService.ts");
    expect(src.includes("export async function buildMerchantCustomerList")).toBe(true);
    expect(src.includes("export async function buildMerchantCustomerDetail")).toBe(true);
    expect(src.includes("export async function buildMerchantCustomerDashboard")).toBe(true);
    expect(src.includes("export async function buildMerchantCustomerInsights")).toBe(true);
  });

  it("registers CRM routes guarded by analyticsView", () => {
    const src = read("src/server/index.ts");
    expect(src.includes('app.post("/merchant/customers"')).toBe(true);
    expect(src.includes('app.post("/merchant/customers/detail"')).toBe(true);
    expect(src.includes('app.post("/merchant/customers/dashboard"')).toBe(true);
    expect(src.includes("buildMerchantCustomerList")).toBe(true);
    expect(src.includes("MERCHANT_PERM.analyticsView")).toBe(true);
  });

  it("keeps customer matching scoped by businessId first", () => {
    const src = read("src/server/merchantCustomerService.ts");
    expect(src.includes("where: { businessId")).toBe(true);
    expect(src.includes("resolveCustomerKey")).toBe(true);
  });

  it("adds additive customer fields to analytics payload without removals", () => {
    const src = read("src/server/merchantAnalyticsService.ts");
    expect(src.includes("customers: {")).toBe(true);
    expect(src.includes("customers: customerHealth")).toBe(true);
    expect(src.includes("repeatCustomers")).toBe(true);
  });

  it("registers the admin customers page route and nav", () => {
    expect(
      read("frontend/src/pages/admin/AdminApp.tsx").includes("AdminCustomersPage"),
    ).toBe(true);
    expect(
      read("frontend/src/pages/admin/AdminLayout.tsx").includes('href: "#/admin/customers"'),
    ).toBe(true);
    expect(
      read("frontend/src/pages/admin/adminHashRoute.ts").includes('"customers"'),
    ).toBe(true);
  });
});
