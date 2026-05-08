import { z } from "zod";
import {
  allowedImageHosts,
  allowedMediaHosts,
  CURRENT_STOREFRONT_VERSION,
  LIMITS,
  type SectionType,
} from "./registry.js";
import { resolveStoreTheme, type ResolvedStoreTheme } from "../shared/storeTheme.js";
import {
  resolveFeatureFlags,
  type ResolvedFeatureFlags,
} from "./featureFlags.js";

export type RawStorefrontSection = {
  id: string;
  type: SectionType;
  enabled: boolean;
  order: number;
  config: Record<string, unknown>;
};

export type RawStorefrontConfig = {
  version: number;
  sections: RawStorefrontSection[];
};

export type ResolvedStorefrontSection = {
  id: string;
  type: SectionType;
  order: number;
  config: Record<string, unknown>;
};

export type ResolvedStorefrontPayload = {
  businessId: number;
  businessType: string;
  templateId: string | null;
  theme: ResolvedStoreTheme;
  featureFlags: ResolvedFeatureFlags;
  storefrontConfigVersion: number;
  sections: ResolvedStorefrontSection[];
  /**
   * Optional preloaded data for renderer (MVP).
   * Keep shapes minimal + safe for public.
   */
  categories?: Array<{ id: number; name: string; parentId: number | null; children: any[] }>;
  featuredProducts?: Array<{
    id: number;
    name: string;
    price: number;
    image: string | null;
    images: string[];
    description: string | null;
    categoryId: number;
  }>;
};

function configBytesLimitCheck(v: unknown): boolean {
  try {
    const s = JSON.stringify(v);
    return s.length <= LIMITS.maxConfigBytes;
  } catch {
    return false;
  }
}

function isAllowedHttpsImageUrl(input: string): boolean {
  try {
    const u = new URL(input);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return allowedImageHosts().includes(host);
  } catch {
    return false;
  }
}

function isAllowedHttpsMediaUrl(input: string): boolean {
  try {
    const u = new URL(input);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return allowedMediaHosts().includes(host);
  } catch {
    return false;
  }
}

const HttpsImageUrl = z
  .string()
  .trim()
  .min(1)
  .max(LIMITS.maxImageUrlLen)
  .refine((s) => isAllowedHttpsImageUrl(s), {
    message: "Недопустимый URL изображения (только https + allowlist)",
  });

const HttpsMediaUrl = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((s) => isAllowedHttpsMediaUrl(s), {
    message: "Недопустимый URL медиа (только https + allowlist)",
  });

const HeroSlideSchema = z.object({
  title: z.string().trim().max(LIMITS.maxTitleLen).default(""),
  subtitle: z.string().trim().max(LIMITS.maxSubtitleLen).default(""),
  imageUrl: HttpsImageUrl,
  ctaText: z.string().trim().max(40).optional().default(""),
  ctaUrl: z.string().trim().max(2048).optional().default(""),
});

const HeroConfigSchema = z
  .object({
    slides: z.array(HeroSlideSchema).max(LIMITS.maxHeroSlides).default([]),
  })
  .default({ slides: [] });

const PromoBlockSchema = z.object({
  title: z.string().trim().max(LIMITS.maxTitleLen),
  subtitle: z.string().trim().max(LIMITS.maxSubtitleLen).optional().default(""),
  imageUrl: HttpsImageUrl.optional(),
});

const PromoConfigSchema = z
  .object({
    blocks: z.array(PromoBlockSchema).max(LIMITS.maxPromoBlocks).default([]),
  })
  .default({ blocks: [] });

const ReviewsItemSchema = z.object({
  author: z.string().trim().max(80).default(""),
  text: z.string().trim().max(LIMITS.maxTextLen).default(""),
  rating: z.number().int().min(1).max(5).optional().default(5),
});

const ReviewsConfigSchema = z
  .object({
    title: z.string().trim().max(LIMITS.maxTitleLen).optional().default("Отзывы"),
    items: z.array(ReviewsItemSchema).max(LIMITS.maxReviews).default([]),
  })
  .default({ title: "Отзывы", items: [] });

const FaqItemSchema = z.object({
  q: z.string().trim().max(LIMITS.maxTitleLen).default(""),
  a: z.string().trim().max(LIMITS.maxTextLen).default(""),
});

const FaqConfigSchema = z
  .object({
    title: z.string().trim().max(LIMITS.maxTitleLen).optional().default("FAQ"),
    items: z.array(FaqItemSchema).max(LIMITS.maxFaqItems).default([]),
  })
  .default({ title: "FAQ", items: [] });

const CountdownConfigSchema = z
  .object({
    title: z.string().trim().max(LIMITS.maxTitleLen).optional().default("Акция"),
    untilIso: z.string().trim().max(64).optional().default(""),
  })
  .default({ title: "Акция", untilIso: "" });

const StoryItemSchema = z.object({
  title: z.string().trim().max(LIMITS.maxTitleLen).optional().default(""),
  imageUrl: HttpsImageUrl.optional(),
});

const StorySliderConfigSchema = z
  .object({
    title: z.string().trim().max(LIMITS.maxTitleLen).optional().default("Stories"),
    items: z.array(StoryItemSchema).max(LIMITS.maxStoryItems).default([]),
  })
  .default({ title: "Stories", items: [] });

const VideoBannerConfigSchema = z
  .object({
    title: z.string().trim().max(LIMITS.maxTitleLen).optional().default(""),
    subtitle: z.string().trim().max(LIMITS.maxSubtitleLen).optional().default(""),
    videoUrl: HttpsMediaUrl.optional().default(""),
    posterUrl: HttpsImageUrl.optional(),
  })
  .default({ title: "", subtitle: "", videoUrl: "", posterUrl: undefined });

const CategoriesConfigSchema = z
  .object({
    title: z.string().trim().max(LIMITS.maxTitleLen).optional().default("Категории"),
    showCounts: z.boolean().optional().default(true),
  })
  .default({ title: "Категории", showCounts: true });

const FeaturedProductsConfigSchema = z
  .object({
    title: z.string().trim().max(LIMITS.maxTitleLen).optional().default("Хиты"),
    limit: z.number().int().min(1).max(LIMITS.maxFeaturedProducts).optional().default(8),
  })
  .default({ title: "Хиты", limit: 8 });

const FooterConfigSchema = z
  .object({
    text: z.string().trim().max(500).optional().default(""),
    instagramUrl: z.string().trim().max(2048).optional().default(""),
    phone: z.string().trim().max(32).optional().default(""),
  })
  .default({ text: "", instagramUrl: "", phone: "" });

const SectionBaseSchema = z.object({
  id: z.string().trim().min(1).max(64),
  type: z.enum([
    "hero",
    "promo",
    "categories",
    "featuredProducts",
    "footer",
    "reviews",
    "faq",
    "countdown",
    "storySlider",
    "videoBanner",
  ]),
  enabled: z.boolean().default(true),
  order: z.number().int().min(0).max(10_000).default(0),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const StorefrontConfigSchema = z
  .object({
    version: z.number().int().min(1).default(CURRENT_STOREFRONT_VERSION),
    sections: z.array(SectionBaseSchema).max(LIMITS.maxSections).default([]),
  })
  .refine((v) => configBytesLimitCheck(v), {
    message: `storefrontConfig слишком большой (лимит ${LIMITS.maxConfigBytes} байт)`,
  });

export function migrateStorefrontConfig(
  raw: unknown,
  fromVersion: number,
  toVersion: number,
): RawStorefrontConfig {
  // v1 only for now: parse + apply defaults
  const parsed = StorefrontConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      version: toVersion,
      sections: defaultSections(),
    };
  }

  const v = parsed.data;
  const version = typeof v.version === "number" ? v.version : fromVersion;
  if (version === toVersion) return { version: toVersion, sections: v.sections as any };

  // future migrations: add here
  return { version: toVersion, sections: v.sections as any };
}

export function defaultStorefrontConfig(): RawStorefrontConfig {
  return {
    version: CURRENT_STOREFRONT_VERSION,
    sections: defaultSections(),
  };
}

function defaultSections(): RawStorefrontSection[] {
  return [
    {
      id: "hero",
      type: "hero",
      enabled: true,
      order: 10,
      config: {
        slides: [],
      },
    },
    {
      id: "promo",
      type: "promo",
      enabled: true,
      order: 20,
      config: { blocks: [] },
    },
    {
      id: "categories",
      type: "categories",
      enabled: true,
      order: 30,
      config: {},
    },
    {
      id: "featured",
      type: "featuredProducts",
      enabled: true,
      order: 40,
      config: {},
    },
    {
      id: "footer",
      type: "footer",
      enabled: true,
      order: 50,
      config: {},
    },
    {
      id: "reviews",
      type: "reviews",
      enabled: false,
      order: 60,
      config: {},
    },
    {
      id: "faq",
      type: "faq",
      enabled: false,
      order: 70,
      config: {},
    },
  ];
}

function resolveSectionConfig(type: SectionType, raw: unknown): Record<string, unknown> {
  const obj = raw != null && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  switch (type) {
    case "hero": {
      const parsed = HeroConfigSchema.safeParse(obj);
      return parsed.success ? parsed.data : HeroConfigSchema.parse({});
    }
    case "promo": {
      const parsed = PromoConfigSchema.safeParse(obj);
      return parsed.success ? parsed.data : PromoConfigSchema.parse({});
    }
    case "categories": {
      const parsed = CategoriesConfigSchema.safeParse(obj);
      return parsed.success ? parsed.data : CategoriesConfigSchema.parse({});
    }
    case "featuredProducts": {
      const parsed = FeaturedProductsConfigSchema.safeParse(obj);
      return parsed.success ? parsed.data : FeaturedProductsConfigSchema.parse({});
    }
    case "footer": {
      const parsed = FooterConfigSchema.safeParse(obj);
      return parsed.success ? parsed.data : FooterConfigSchema.parse({});
    }
    case "reviews": {
      const parsed = ReviewsConfigSchema.safeParse(obj);
      return parsed.success ? parsed.data : ReviewsConfigSchema.parse({});
    }
    case "faq": {
      const parsed = FaqConfigSchema.safeParse(obj);
      return parsed.success ? parsed.data : FaqConfigSchema.parse({});
    }
    case "countdown": {
      const parsed = CountdownConfigSchema.safeParse(obj);
      return parsed.success ? parsed.data : CountdownConfigSchema.parse({});
    }
    case "storySlider": {
      const parsed = StorySliderConfigSchema.safeParse(obj);
      return parsed.success ? parsed.data : StorySliderConfigSchema.parse({});
    }
    case "videoBanner": {
      const parsed = VideoBannerConfigSchema.safeParse(obj);
      return parsed.success ? parsed.data : VideoBannerConfigSchema.parse({});
    }
    default:
      return {};
  }
}

export function resolveStorefrontConfig(input: {
  businessId: number;
  businessType: string;
  templateId: string | null;
  storefrontConfigVersion: number;
  rawStorefrontConfig: unknown;
  rawThemeConfig: unknown;
  rawFeatureFlags: unknown;
}): ResolvedStorefrontPayload {
  const migrated = migrateStorefrontConfig(
    input.rawStorefrontConfig,
    Number(input.storefrontConfigVersion) || 1,
    CURRENT_STOREFRONT_VERSION,
  );

  const enabledRaw = migrated.sections.filter(
    (s) => s && (s as any).enabled !== false,
  );
  const sourceSections: RawStorefrontSection[] =
    enabledRaw.length > 0 ? enabledRaw : defaultSections();

  const sectionsResolved: ResolvedStorefrontSection[] = sourceSections
    .map((s) => ({
      id: String((s as any).id),
      type: (s as any).type as SectionType,
      order: Number((s as any).order) || 0,
      config: resolveSectionConfig((s as any).type as SectionType, (s as any).config),
    }))
    .sort((a, b) => a.order - b.order);

  return {
    businessId: input.businessId,
    businessType: input.businessType,
    templateId: input.templateId,
    theme: resolveStoreTheme(input.templateId, input.rawThemeConfig),
    featureFlags: resolveFeatureFlags(input.rawFeatureFlags),
    storefrontConfigVersion: CURRENT_STOREFRONT_VERSION,
    sections: sectionsResolved,
  };
}

