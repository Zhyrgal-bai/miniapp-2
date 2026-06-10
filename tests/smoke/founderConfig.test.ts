import { describe, expect, it } from "vitest";
import {
  ARCHA_FOUNDER,
  enabledFounderSocials,
} from "../../frontend/src/config/founder";

describe("founder config", () => {
  it("exposes core founder fields", () => {
    expect(ARCHA_FOUNDER.name).toBe("Жыргал");
    expect(ARCHA_FOUNDER.badge).toBe("Основатель ARCHA");
    expect(ARCHA_FOUNDER.sectionTitle).toContain("Создано в Кыргызстане");
    expect(ARCHA_FOUNDER.description.length).toBeGreaterThan(20);
  });

  it("encodes the public photo path (non-ASCII safe)", () => {
    expect(ARCHA_FOUNDER.photo).toBe(encodeURI("/Жыргал.jpeg"));
    expect(ARCHA_FOUNDER.photo.startsWith("/%")).toBe(true);
  });

  it("returns only enabled socials with non-empty hrefs", () => {
    const socials = enabledFounderSocials();
    for (const s of socials) {
      expect(s.enabled).toBe(true);
      expect(s.href.trim()).not.toBe("");
    }
    // Instagram + Telegram are configured by default; GitHub is optional.
    const ids = socials.map((s) => s.id);
    expect(ids).toContain("instagram");
    expect(ids).toContain("telegram");
  });

  it("uses zhyrgal4_ik as default Instagram handle", () => {
    const ig = ARCHA_FOUNDER.socials.find((s) => s.id === "instagram");
    expect(ig?.href).toContain("zhyrgal4_ik");
    expect(ig?.handle).toBe("@zhyrgal4_ik");
  });

  it("keeps github optional", () => {
    const github = ARCHA_FOUNDER.socials.find((s) => s.id === "github");
    expect(github).toBeTruthy();
    // Disabled when no URL configured.
    if (github && github.href.trim() === "") {
      expect(github.enabled).toBe(false);
    }
  });
});
