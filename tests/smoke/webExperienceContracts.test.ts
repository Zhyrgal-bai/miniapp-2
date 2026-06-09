import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

describe("web experience contracts", () => {
  it("exposes merchant slug + web-profile services", () => {
    const slug = read("src/server/merchantSlugService.ts");
    expect(slug.includes("export async function changeMerchantSlug")).toBe(true);
    expect(slug.includes("export async function resolveSlugOrAlias")).toBe(true);
    expect(slug.includes("export async function checkSlugAvailability")).toBe(true);
  });

  it("registers web experience routes with settings perm", () => {
    const src = read("src/server/index.ts");
    expect(src.includes('app.post("/api/merchant/slug"')).toBe(true);
    expect(src.includes('app.get("/api/merchant/slug/availability"')).toBe(true);
    expect(src.includes('app.post("/api/merchant/web-profile"')).toBe(true);
    expect(src.includes("MERCHANT_PERM.settingsManage")).toBe(true);
  });

  it("wires SPA meta injection with graceful fallback", () => {
    const src = read("src/server/index.ts");
    expect(src.includes("isMetaInjectablePath")).toBe(true);
    expect(src.includes("renderSpaHtmlWithMeta")).toBe(true);
    expect(src.includes("sendSpaIndexHtml(res, next)")).toBe(true);
    const meta = read("src/server/storefrontHtmlMeta.ts");
    expect(meta.includes("buildStoreSeoMeta")).toBe(true);
    expect(meta.includes("renderSeoMetaTags")).toBe(true);
  });

  it("resolves historical slug aliases in by-slug route", () => {
    const src = read("src/server/index.ts");
    expect(src.includes("resolveSlugOrAlias(slug)")).toBe(true);
  });

  it("adds additive webProfile to public payload and schema", () => {
    expect(read("src/server/storefrontPublicPayload.ts").includes("extractWebProfile")).toBe(true);
    expect(read("src/storefront/storefrontPublicApiResponseSchema.ts").includes("webProfile")).toBe(true);
  });

  it("keeps registration Telegram-first (browser gate)", () => {
    const reg = read("frontend/src/pages/MerchantRegisterPage.tsx");
    expect(reg.includes("isTelegramMiniAppEnv()")).toBe(true);
    expect(reg.includes("MerchantRegisterTelegramGate")).toBe(true);
  });

  it("does NOT introduce a second checkout (web still funnels to Telegram)", () => {
    // Showcase blocks are presentation only; commerce stays gated by isStorefrontCommerceEnabled.
    const renderer = read("frontend/src/components/storefront/StorefrontRenderer.tsx");
    expect(renderer.includes("WebShowcaseHeader")).toBe(true);
    expect(renderer.includes("isWebBrowse")).toBe(true);
    // No checkout/order POST added to web showcase components.
    const contacts = read("frontend/src/components/storefront/web/WebShowcaseContacts.tsx");
    expect(contacts.includes("/orders")).toBe(false);
  });

  it("defines StorefrontSlugAlias model and ops website metrics", () => {
    expect(read("prisma/schema.prisma").includes("model StorefrontSlugAlias")).toBe(true);
    expect(read("src/server/platformOpsService.ts").includes("website: {")).toBe(true);
  });

  it("landing page has required sections", () => {
    const landing = read("frontend/src/pages/MerchantLandingPage.tsx");
    expect(landing.includes('id="business-types"')).toBe(true);
    expect(landing.includes('id="how"')).toBe(true);
    expect(landing.includes('id="pricing"')).toBe(true);
  });

  it("landing renders founder section + branding line (Phase 17.1)", () => {
    const landing = read("frontend/src/pages/MerchantLandingPage.tsx");
    expect(landing.includes("<FounderSection />")).toBe(true);
    expect(landing.includes("ARCHA Generation One")).toBe(true);
    const founder = read("frontend/src/components/landing/FounderSection.tsx");
    expect(founder.includes("enabledFounderSocials")).toBe(true);
    expect(founder.includes("onError")).toBe(true);
  });

  it("merchant showcase footer says Powered by ARCHA with no founder data", () => {
    const footer = read("frontend/src/components/storefront/web/WebShowcaseFooter.tsx");
    expect(footer.includes("Powered by ARCHA")).toBe(true);
    // No founder data leaks into merchant stores (name + founder config import).
    expect(footer.includes("Жыргал")).toBe(false);
    expect(footer.includes("ARCHA_FOUNDER")).toBe(false);
    expect(footer.includes("config/founder")).toBe(false);
    const renderer = read("frontend/src/components/storefront/StorefrontRenderer.tsx");
    expect(renderer.includes("WebShowcaseFooter")).toBe(true);
  });
});
