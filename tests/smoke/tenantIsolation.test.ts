import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertBusinessScope,
  BusinessScopeError,
} from "../../src/server/businessScope.js";

function read(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

describe("tenant isolation contracts", () => {
  it("assertBusinessScope allows same tenant", () => {
    expect(() =>
      assertBusinessScope({
        authenticatedBusinessId: 42,
        resourceBusinessId: 42,
        resourceId: 1,
      }),
    ).not.toThrow();
  });

  it("assertBusinessScope hides cross-tenant as 404", () => {
    expect(() =>
      assertBusinessScope({
        authenticatedBusinessId: 1,
        resourceBusinessId: 2,
        resourceId: 99,
      }),
    ).toThrow(BusinessScopeError);
    try {
      assertBusinessScope({
        authenticatedBusinessId: 1,
        resourceBusinessId: 2,
      });
    } catch (e) {
      expect(e).toBeInstanceOf(BusinessScopeError);
      expect((e as BusinessScopeError).httpStatus).toBe(404);
    }
  });

  it("merchant CRM routes use analyticsView not body businessId", () => {
    const src = read("src/server/index.ts");
    expect(src.includes('app.post("/merchant/customers"')).toBe(true);
    expect(src.includes("MERCHANT_PERM.analyticsView")).toBe(true);
    expect(src.includes("buildMerchantCustomerList")).toBe(true);
  });

  it("merchant marketing routes scope by merchant.businessId", () => {
    const src = read("src/server/merchantMarketingService.ts");
    expect(src.includes("where: { businessId")).toBe(true);
    expect(src.includes("export async function")).toBe(true);
  });

  it("requireMerchantStaff logs tenant_access_denied on missing staff", () => {
    const src = read("src/server/index.ts");
    expect(src.includes("logTenantAccessDenied")).toBe(true);
    expect(src.includes('reason: "no_staff_membership"')).toBe(true);
  });

  it("resolveTenantHint consolidates duplicate parsers", () => {
    const hint = read("src/server/resolveTenantHint.ts");
    const index = read("src/server/index.ts");
    const middleware = read("src/middleware/business.middleware.ts");
    expect(hint.includes("export function resolveTenantHintFromRequest")).toBe(
      true,
    );
    expect(index.includes("resolveTenantHintFromRequest(req)")).toBe(true);
    expect(middleware.includes("resolveTenantHintFromRequest")).toBe(true);
  });

  it("receipt upload uses assertBusinessScope", () => {
    const src = read("src/server/index.ts");
    expect(src.includes("assertBusinessScope")).toBe(true);
    expect(src.includes("validateReceiptFile")).toBe(true);
  });
});
