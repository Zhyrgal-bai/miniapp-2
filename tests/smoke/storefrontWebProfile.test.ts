import { describe, expect, it } from "vitest";
import {
  emptyWebProfile,
  extractWebProfile,
  mergeWebProfileIntoMerchantConfig,
  normalizeWebProfile,
  webProfileHasContent,
} from "../../src/shared/storefrontWebProfile.js";

describe("storefrontWebProfile", () => {
  it("normalizes arbitrary input safely", () => {
    const p = normalizeWebProfile({
      coverUrl: "https://cdn.example.com/cover.jpg",
      slogan: "  Лучший кофе  ",
      story: "История магазина",
      accentColor: "#7fff3a",
      social: { instagram: "@my_shop", telegram: "my_shop", whatsapp: "+996700112233", website: "https://shop.kg" },
    });
    expect(p.coverUrl).toBe("https://cdn.example.com/cover.jpg");
    expect(p.slogan).toBe("Лучший кофе");
    expect(p.accentColor).toBe("#7fff3a");
    expect(p.social.instagram).toBe("my_shop");
    expect(p.social.website).toBe("https://shop.kg");
  });

  it("rejects invalid url / color", () => {
    const p = normalizeWebProfile({ coverUrl: "not-a-url", accentColor: "red" });
    expect(p.coverUrl).toBeNull();
    expect(p.accentColor).toBeNull();
  });

  it("returns empty profile for junk", () => {
    expect(normalizeWebProfile(null)).toEqual(emptyWebProfile());
    expect(normalizeWebProfile("x")).toEqual(emptyWebProfile());
  });

  it("extracts and merges via merchantConfig", () => {
    const merged = mergeWebProfileIntoMerchantConfig(
      { enableOrderOptions: true },
      normalizeWebProfile({ slogan: "Hello" }),
    );
    expect((merged as any).enableOrderOptions).toBe(true);
    const extracted = extractWebProfile(merged);
    expect(extracted.slogan).toBe("Hello");
  });

  it("detects content presence", () => {
    expect(webProfileHasContent(emptyWebProfile())).toBe(false);
    expect(webProfileHasContent(normalizeWebProfile({ slogan: "x" }))).toBe(true);
  });
});
