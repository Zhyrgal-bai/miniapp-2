export type SectionType =
  | "hero"
  | "promo"
  | "categories"
  | "featuredProducts"
  | "footer"
  | "reviews"
  | "faq"
  | "countdown"
  | "storySlider"
  | "videoBanner";

export const CURRENT_STOREFRONT_VERSION = 1 as const;

export const LIMITS = {
  maxSections: 20,
  maxHeroSlides: 5,
  maxPromoBlocks: 6,
  maxReviews: 12,
  maxFaqItems: 20,
  maxStoryItems: 12,
  maxFeaturedProducts: 24,
  maxConfigBytes: 64 * 1024,
  maxTextLen: 280,
  maxTitleLen: 80,
  maxSubtitleLen: 140,
  maxImageUrlLen: 2048,
} as const;

function parseAllowedImageHostsFromEnv(): string[] {
  const raw = (process.env.STOREFRONT_ALLOWED_IMAGE_HOSTS || "").trim();
  if (!raw) return [];
  const parts = raw
    .split(/[,\s;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

/**
 * Host allowlist for image URLs. Add your own via env:
 * `STOREFRONT_ALLOWED_IMAGE_HOSTS=res.cloudinary.com,cdn.example.com`
 */
export function allowedImageHosts(): string[] {
  const fromEnv = parseAllowedImageHostsFromEnv();
  const defaults = [
    "res.cloudinary.com",
    "images.unsplash.com",
    "picsum.photos",
  ];
  return Array.from(new Set([...defaults, ...fromEnv]));
}

function parseAllowedMediaHostsFromEnv(): string[] {
  const raw = (process.env.STOREFRONT_ALLOWED_MEDIA_HOSTS || "").trim();
  if (!raw) return [];
  const parts = raw
    .split(/[,\s;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

/** Host allowlist for media URLs (e.g. mp4). */
export function allowedMediaHosts(): string[] {
  const fromEnv = parseAllowedMediaHostsFromEnv();
  const defaults = [
    "res.cloudinary.com",
  ];
  return Array.from(new Set([...defaults, ...fromEnv]));
}

