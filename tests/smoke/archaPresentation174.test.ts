import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ARCHA_BRAND } from "../../frontend/src/config/brandAssets";
import { ARCHA_FOUNDER } from "../../frontend/src/config/founder";
import { ARCHA_ERROR_COPY } from "../../frontend/src/components/errors/errorCopy";
import { ARCHA_INTRO_SESSION_KEY } from "../../frontend/src/components/branding/ArchaIntro";

function read(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

describe("ARCHA Phase 17.4 presentation contracts", () => {
  it("uses favicon.png as canonical logo icon", () => {
    expect(ARCHA_BRAND.favicon).toBe("/favicon.png");
    expect(ARCHA_BRAND.logoIcon).toBe("/favicon.png");
    expect(read("frontend/index.html").includes('href="/favicon.png"')).toBe(true);
    expect(read("frontend/src/config/brandAssets.ts").includes("favicon2")).toBe(false);
  });

  it("defaults founder Instagram to zhyrgal4_ik", () => {
    const ig = ARCHA_FOUNDER.socials.find((s) => s.id === "instagram");
    expect(ig?.href).toContain("zhyrgal4_ik");
    expect(ig?.handle).toBe("@zhyrgal4_ik");
  });

  it("exposes universal error kinds", () => {
    expect(ARCHA_ERROR_COPY.not_found.code).toBe("404");
    expect(ARCHA_ERROR_COPY.no_tenant.title).toContain("витрину");
    expect(ARCHA_ERROR_COPY.merchant_not_found.title).toContain("не найден");
    expect(ARCHA_ERROR_COPY.crash.title.length).toBeGreaterThan(5);
  });

  it("defines session-cached intro key", () => {
    expect(ARCHA_INTRO_SESSION_KEY).toBe("archa_intro_seen");
    expect(read("frontend/src/components/branding/ArchaIntro.tsx").includes("sessionStorage")).toBe(
      true,
    );
  });

  it("routes unknown paths to NotFoundRoute", () => {
    const main = read("frontend/src/main.tsx");
    expect(main.includes("NotFoundRoute")).toBe(true);
    expect(main.includes('path="*" element={<NotFoundRoute />}') || main.includes('path="*" element={<NotFoundRoute/>}')).toBe(true);
  });

  it("wires universal error shell to storefront and app boundaries", () => {
    expect(read("frontend/src/components/storefront/runtime/StoreNotFoundScreen.tsx").includes("ArchaErrorShellWithRetry")).toBe(true);
    expect(read("frontend/src/components/ui/AppErrorBoundary.tsx").includes("ArchaErrorShell")).toBe(true);
    expect(read("frontend/src/App.tsx").includes('kind="no_tenant"')).toBe(true);
  });

  it("shows premium intro on browser merchant landing only", () => {
    const dash = read("frontend/src/pages/MerchantDashboardPage.tsx");
    expect(dash.includes("ArchaIntro")).toBe(true);
    expect(dash.includes("MerchantLandingPage")).toBe(true);
    expect(dash.includes("PlatformPage")).toBe(true);
  });

  it("landing includes founder nav, why-telegram, and footer socials", () => {
    const landing = read("frontend/src/pages/MerchantLandingPage.tsx");
    expect(landing.includes('href="#founder"')).toBe(true);
    expect(landing.includes('id="why-telegram"')).toBe(true);
    expect(landing.includes("enabledFounderSocials")).toBe(true);
    expect(landing.includes("archa-landing__feature-icon--")).toBe(true);
  });
});
