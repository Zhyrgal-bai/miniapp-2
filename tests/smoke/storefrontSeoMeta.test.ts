import { describe, expect, it } from "vitest";
import {
  buildLandingSeoMeta,
  buildStoreSeoMeta,
  escapeHtmlAttribute,
  renderSeoMetaTags,
  seoCompletenessScore,
} from "../../src/shared/storefrontSeoMeta.js";

describe("storefrontSeoMeta", () => {
  it("builds store meta with brand suffix and canonical", () => {
    const meta = buildStoreSeoMeta({
      storeName: "Nur Market",
      slogan: "Свежие цветы",
      description: null,
      city: "Бишкек",
      imageUrl: "https://cdn/x.jpg",
      canonicalUrl: "https://archa.app/s/nur-market",
      telegramUrl: null,
    });
    expect(meta.title).toContain("Nur Market");
    expect(meta.title).toContain("ARCHA");
    expect(meta.description).toContain("Свежие цветы");
    expect(meta.canonicalUrl).toBe("https://archa.app/s/nur-market");
    expect(meta.twitterCard).toBe("summary_large_image");
  });

  it("falls back to summary card without image", () => {
    const meta = buildStoreSeoMeta({
      storeName: "Shop",
      slogan: null,
      description: null,
      city: null,
      imageUrl: null,
      canonicalUrl: null,
      telegramUrl: null,
    });
    expect(meta.twitterCard).toBe("summary");
    expect(meta.ogImage).toBeNull();
  });

  it("escapes HTML attributes", () => {
    expect(escapeHtmlAttribute('a"<>&')).toBe("a&quot;&lt;&gt;&amp;");
  });

  it("renders meta tags including title and og", () => {
    const html = renderSeoMetaTags(
      buildLandingSeoMeta("https://archa.app/merchant"),
    );
    expect(html).toContain("<title>");
    expect(html).toContain('property="og:title"');
    expect(html).toContain('rel="canonical"');
  });

  it("scores SEO completeness", () => {
    expect(seoCompletenessScore({ hasStoreName: true, hasSlug: true, hasDescription: true, hasImage: true })).toBe(100);
    expect(seoCompletenessScore({ hasStoreName: true, hasSlug: true, hasDescription: false, hasImage: false })).toBe(50);
  });
});
