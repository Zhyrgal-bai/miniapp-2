/**
 * Storefront SEO/social meta builder (Phase 17.5) — pure functions.
 *
 * Builds title/description/canonical/OpenGraph/Twitter tags from existing
 * storefront payload data + web profile. Used by the server to inject meta into
 * the SPA index.html for crawlers/social unfurls, and mirrored on the client.
 */

export type SeoMetaInput = {
  storeName: string | null;
  slogan: string | null;
  description: string | null;
  city: string | null;
  imageUrl: string | null;
  canonicalUrl: string | null;
  /** Telegram deep link for the store. */
  telegramUrl: string | null;
};

export type SeoMeta = {
  title: string;
  description: string;
  canonicalUrl: string | null;
  ogTitle: string;
  ogDescription: string;
  ogType: string;
  ogImage: string | null;
  ogUrl: string | null;
  twitterCard: string;
};

const BRAND = "ARCHA";
const MAX_TITLE = 70;
const MAX_DESC = 200;

function clamp(value: string, max: number): string {
  const t = value.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const v of values) {
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return "";
}

/** Escape a string for safe insertion into an HTML attribute value. */
export function escapeHtmlAttribute(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Build the merchant store SEO meta model. */
export function buildStoreSeoMeta(input: SeoMetaInput): SeoMeta {
  const name = firstNonEmpty(input.storeName, "Магазин");
  const title = clamp(`${name} · ${BRAND}`, MAX_TITLE);
  const descSource = firstNonEmpty(
    input.description,
    input.slogan,
    input.city ? `${name} — ${input.city}. Заказы через Telegram.` : "",
    `${name} — витрина магазина на платформе ${BRAND}. Заказы через Telegram.`,
  );
  const description = clamp(descSource, MAX_DESC);
  return {
    title,
    description,
    canonicalUrl: input.canonicalUrl,
    ogTitle: title,
    ogDescription: description,
    ogType: "website",
    ogImage: input.imageUrl,
    ogUrl: input.canonicalUrl,
    twitterCard: input.imageUrl != null ? "summary_large_image" : "summary",
  };
}

/** Default platform landing SEO meta. */
export function buildLandingSeoMeta(canonicalUrl: string | null): SeoMeta {
  const title = `${BRAND} — Telegram Commerce Platform`;
  const description =
    "ARCHA — платформа для запуска магазина в Telegram: витрина, заказы, оплата, CRM, маркетинг и аналитика. 5 заказов бесплатно.";
  return {
    title,
    description,
    canonicalUrl,
    ogTitle: title,
    ogDescription: description,
    ogType: "website",
    ogImage: null,
    ogUrl: canonicalUrl,
    twitterCard: "summary",
  };
}

/** Render the meta as an HTML fragment of <title> + <meta>/<link> tags. */
export function renderSeoMetaTags(meta: SeoMeta): string {
  const esc = escapeHtmlAttribute;
  const lines: string[] = [];
  lines.push(`<title>${esc(meta.title)}</title>`);
  lines.push(`<meta name="description" content="${esc(meta.description)}" />`);
  if (meta.canonicalUrl != null) {
    lines.push(`<link rel="canonical" href="${esc(meta.canonicalUrl)}" />`);
  }
  lines.push(`<meta property="og:title" content="${esc(meta.ogTitle)}" />`);
  lines.push(`<meta property="og:description" content="${esc(meta.ogDescription)}" />`);
  lines.push(`<meta property="og:type" content="${esc(meta.ogType)}" />`);
  if (meta.ogUrl != null) {
    lines.push(`<meta property="og:url" content="${esc(meta.ogUrl)}" />`);
  }
  if (meta.ogImage != null) {
    lines.push(`<meta property="og:image" content="${esc(meta.ogImage)}" />`);
  }
  lines.push(`<meta name="twitter:card" content="${esc(meta.twitterCard)}" />`);
  lines.push(`<meta name="twitter:title" content="${esc(meta.ogTitle)}" />`);
  lines.push(`<meta name="twitter:description" content="${esc(meta.ogDescription)}" />`);
  if (meta.ogImage != null) {
    lines.push(`<meta name="twitter:image" content="${esc(meta.ogImage)}" />`);
  }
  return lines.join("\n    ");
}

/** SEO completeness score (0–100) for admin readiness metrics. */
export function seoCompletenessScore(input: {
  hasStoreName: boolean;
  hasDescription: boolean;
  hasImage: boolean;
  hasSlug: boolean;
}): number {
  let score = 0;
  if (input.hasStoreName) score += 25;
  if (input.hasSlug) score += 25;
  if (input.hasDescription) score += 25;
  if (input.hasImage) score += 25;
  return score;
}
