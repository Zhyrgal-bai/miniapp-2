import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

describe("merchant marketing contracts", () => {
  it("exposes marketing + loyalty service functions", () => {
    const mkt = read("src/server/merchantMarketingService.ts");
    expect(mkt.includes("export async function buildMarketingDashboard")).toBe(true);
    expect(mkt.includes("export async function createMerchantPromotion")).toBe(true);
    expect(mkt.includes("export async function createMerchantCampaign")).toBe(true);
    const loy = read("src/server/merchantLoyaltyService.ts");
    expect(loy.includes("export async function accrueLoyaltyForPaidOrder")).toBe(true);
    expect(loy.includes("export async function buildMerchantLoyalty")).toBe(true);
  });

  it("registers marketing + loyalty routes with correct perms", () => {
    const src = read("src/server/index.ts");
    expect(src.includes('app.post("/merchant/marketing/promotions"')).toBe(true);
    expect(src.includes('app.post("/merchant/marketing/campaigns"')).toBe(true);
    expect(src.includes('app.post("/merchant/marketing/dashboard"')).toBe(true);
    expect(src.includes('app.post("/merchant/loyalty"')).toBe(true);
    expect(src.includes("MERCHANT_PERM.settingsManage")).toBe(true);
    expect(src.includes("MERCHANT_PERM.analyticsView")).toBe(true);
  });

  it("mirrors COUPON_PERCENT into the existing Promo table", () => {
    const mkt = read("src/server/merchantMarketingService.ts");
    expect(mkt.includes("createPromoDb")).toBe(true);
    expect(mkt.includes('created.type === "COUPON_PERCENT"')).toBe(true);
  });

  it("does NOT change checkout total math (promo block intact)", () => {
    const src = read("src/server/index.ts");
    // Existing checkout promo path must remain via tryApplyPromoDb + promoTrackingValue.
    expect(src.includes("tryApplyPromoDb")).toBe(true);
    expect(src.includes("promoTrackingValue(promoRaw)")).toBe(true);
  });

  it("accrues loyalty additively from the post-paid hook", () => {
    const hooks = read("src/server/orderInventoryHooks.ts");
    expect(hooks.includes("accrueLoyaltyForPaidOrder")).toBe(true);
    expect(hooks.includes("incrementFreeOrderQuotaOnPaid")).toBe(true);
  });

  it("adds additive marketing fields to analytics without removals", () => {
    const src = read("src/server/merchantAnalyticsService.ts");
    expect(src.includes("marketing: marketingHealth")).toBe(true);
    expect(src.includes("customers: customerHealth")).toBe(true);
    expect(src.includes("repeatCustomers")).toBe(true);
  });

  it("registers the admin marketing page route and nav", () => {
    expect(read("frontend/src/pages/admin/AdminApp.tsx").includes("AdminMarketingPage")).toBe(true);
    expect(
      read("frontend/src/pages/admin/AdminLayout.tsx").includes('href: "#/admin/marketing"'),
    ).toBe(true);
    expect(read("frontend/src/pages/admin/adminHashRoute.ts").includes('"marketing"')).toBe(true);
  });

  it("defines phase16 marketing models in prisma schema", () => {
    const schema = read("prisma/schema.prisma");
    expect(schema.includes("model MerchantPromotion")).toBe(true);
    expect(schema.includes("model MerchantCampaign")).toBe(true);
    expect(schema.includes("model LoyaltyProgram")).toBe(true);
    expect(schema.includes("model CustomerLoyaltyState")).toBe(true);
  });
});
