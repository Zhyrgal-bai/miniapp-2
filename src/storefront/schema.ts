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
  storefrontHeaderConfig?: StorefrontHeaderConfig;
  storefrontCardConfig?: StorefrontCardConfig;
  storefrontTextConfig?: StorefrontTextConfig;
  storefrontStyleConfig?: StorefrontStyleConfig;
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
  storefrontHeaderConfig: StorefrontHeaderConfig;
  storefrontCardConfig: StorefrontCardConfig;
  storefrontTextConfig: StorefrontTextConfig;
  storefrontStyleConfig: StorefrontStyleConfig;
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
    createdAt?: string | Date;
    sold30d?: number;
  }>;
};

export type StorefrontHeaderConfig = {
  variant: "centered" | "split" | "minimal" | "luxury" | "commerce";
  titleText: string;
  showAvatar: boolean;
  showSearch: boolean;
  sticky: boolean;
  glass: boolean;
  alignment: "left" | "center";
  height: "compact" | "normal" | "large";
  logoSize: number;
  titleStyle: "normal" | "uppercase" | "wide";
  shadow: boolean;
  border: boolean;
};

export type StorefrontCardConfig = {
  variant: "compact" | "minimal" | "modern" | "luxury" | "fashion" | "marketplace" | "neon";
  imageRatio: "square" | "portrait" | "landscape";
  imageFit: "cover" | "contain";
  imageShadow: boolean;
  rounded: boolean;
  shadow: boolean;
  compact: boolean;
  density: "compact" | "normal" | "airy";
  priceStyle: "bold" | "luxury" | "compact";
  showBadges: boolean;
  badgeStyle: "minimal" | "glow" | "luxury";
  badgePosition: "topLeft" | "topRight" | "bottomLeft";
  showWishlist: boolean;
  ctaStyle: "pill" | "square" | "glow" | "outline" | "full";
  textAlign: "left" | "center";
  hoverEffect: "none" | "scale" | "lift";
};

export type StorefrontTextConfig = {
  heroDefaultTitle: string;
  heroDefaultSubtitle: string;
  heroDefaultCta: string;

  addToCartLabel: string;
  buyNowLabel: string;
  viewAllLabel: string;
  checkoutLabel: string;

  titleCategories: string;
  titleHits: string;
  titleTrending: string;
  titleFaq: string;
  titleReviews: string;

  emptyCartTitle: string;
  emptyCartHint: string;
  emptyCatalogTitle: string;
  emptyCatalogHint: string;
  emptySearchTitle: string;
  emptySearchHint: string;

  menuShopLabel: string;
  menuCartLabel: string;
  menuOrdersLabel: string;
  menuFaqLabel: string;
};

export type StorefrontStyleConfig = {
  layout: {
    density: "compact" | "normal" | "comfortable";
    sectionSpacing: number;
    productGap: number;
    mobilePadding: number;
    contentWidth: "full" | "narrow";
  };
  typography: {
    fontBody: "system" | "inter" | "poppins" | "manrope" | "montserrat" | "bebasNeue" | "playfairDisplay";
    fontTitle: "system" | "inter" | "poppins" | "manrope" | "montserrat" | "bebasNeue" | "playfairDisplay";
    fontButton: "system" | "inter" | "poppins" | "manrope" | "montserrat" | "bebasNeue" | "playfairDisplay";
    titleSize: number;
    sectionTitleSize: number;
    buttonSize: number;
    titleWeight: number;
    uppercaseTitles: boolean;
    letterSpacing: number;
    lineHeight: number;
  };
  chips: {
    shape: "pill" | "square";
    style: "outline" | "filled";
    size: "sm" | "md" | "lg";
    radius: number;
    gap: number;
  };
  buttons: {
    radius: number;
    height: number;
    shadow: boolean;
    glow: boolean;
    variant: "filled" | "outline";
    compact: boolean;
    animationLevel: "off" | "low" | "high";
  };
  hero: {
    layout: "centered" | "split" | "banner";
    overlay: boolean;
    height: number;
    radius: number;
    shadow: boolean;
    alignment: "left" | "center";
    ctaPosition: "below" | "overlay" | "hidden";
  };
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
  imageUrl: HttpsImageUrl.optional(),
  imagePublicId: z.string().trim().max(256).optional(),
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
  imagePublicId: z.string().trim().max(256).optional(),
});

const PromoConfigSchema = z
  .object({
    blocks: z.array(PromoBlockSchema).max(LIMITS.maxPromoBlocks).default([]),
  })
  .default({ blocks: [] });

const StorefrontHeaderConfigSchema = z
  .object({
    variant: z.enum(["centered", "split", "minimal", "luxury", "commerce"]).default("commerce"),
    titleText: z.string().trim().max(32).optional().default(""),
    showAvatar: z.boolean().default(true),
    showSearch: z.boolean().default(false),
    sticky: z.boolean().default(true),
    glass: z.boolean().default(false),
    alignment: z.enum(["left", "center"]).default("center"),
    height: z.enum(["compact", "normal", "large"]).default("normal"),
    logoSize: z.number().int().min(18).max(64).default(34),
    titleStyle: z.enum(["normal", "uppercase", "wide"]).default("wide"),
    shadow: z.boolean().default(true),
    border: z.boolean().default(false),
  })
  .default({
    variant: "commerce",
    titleText: "",
    showAvatar: true,
    showSearch: false,
    sticky: true,
    glass: false,
    alignment: "center",
    height: "normal",
    logoSize: 34,
    titleStyle: "wide",
    shadow: true,
    border: false,
  });

const StorefrontCardConfigSchema = z
  .object({
    variant: z.enum(["compact", "minimal", "modern", "luxury", "fashion", "marketplace", "neon"]).default("modern"),
    imageRatio: z.enum(["square", "portrait", "landscape"]).default("square"),
    imageFit: z.enum(["cover", "contain"]).default("cover"),
    imageShadow: z.boolean().default(false),
    rounded: z.boolean().default(true),
    shadow: z.boolean().default(true),
    compact: z.boolean().default(false),
    density: z.enum(["compact", "normal", "airy"]).default("normal"),
    priceStyle: z.enum(["bold", "luxury", "compact"]).default("bold"),
    showBadges: z.boolean().default(true),
    badgeStyle: z.enum(["minimal", "glow", "luxury"]).default("minimal"),
    badgePosition: z.enum(["topLeft", "topRight", "bottomLeft"]).default("topLeft"),
    showWishlist: z.boolean().default(false),
    ctaStyle: z.enum(["pill", "square", "glow", "outline", "full"]).default("pill"),
    textAlign: z.enum(["left", "center"]).default("left"),
    hoverEffect: z.enum(["none", "scale", "lift"]).default("lift"),
  })
  .default({
    variant: "modern",
    imageRatio: "square",
    imageFit: "cover",
    imageShadow: false,
    rounded: true,
    shadow: true,
    compact: false,
    density: "normal",
    priceStyle: "bold",
    showBadges: true,
    badgeStyle: "minimal",
    badgePosition: "topLeft",
    showWishlist: false,
    ctaStyle: "pill",
    textAlign: "left",
    hoverEffect: "lift",
  });

const StorefrontTextConfigSchema = z
  .object({
    heroDefaultTitle: z.string().trim().max(LIMITS.maxTitleLen).optional().default("Добро пожаловать"),
    heroDefaultSubtitle: z.string().trim().max(LIMITS.maxSubtitleLen).optional().default(""),
    heroDefaultCta: z.string().trim().max(40).optional().default(""),
    addToCartLabel: z.string().trim().max(24).optional().default("Добавить"),
    buyNowLabel: z.string().trim().max(24).optional().default("Купить"),
    viewAllLabel: z.string().trim().max(24).optional().default("Смотреть всё"),
    checkoutLabel: z.string().trim().max(24).optional().default("Оформить"),

    titleCategories: z.string().trim().max(LIMITS.maxTitleLen).optional().default("Категории"),
    titleHits: z.string().trim().max(LIMITS.maxTitleLen).optional().default("Хиты"),
    titleTrending: z.string().trim().max(LIMITS.maxTitleLen).optional().default("Trending"),
    titleFaq: z.string().trim().max(LIMITS.maxTitleLen).optional().default("FAQ"),
    titleReviews: z.string().trim().max(LIMITS.maxTitleLen).optional().default("Отзывы"),

    emptyCartTitle: z.string().trim().max(LIMITS.maxTitleLen).optional().default("Корзина пуста"),
    emptyCartHint: z.string().trim().max(LIMITS.maxTextLen).optional().default("Добавьте товары, чтобы оформить заказ"),
    emptyCatalogTitle: z.string().trim().max(LIMITS.maxTitleLen).optional().default("Нет товаров"),
    emptyCatalogHint: z.string().trim().max(LIMITS.maxTextLen).optional().default("Скоро появятся товары"),
    emptySearchTitle: z.string().trim().max(LIMITS.maxTitleLen).optional().default("Ничего не найдено"),
    emptySearchHint: z.string().trim().max(LIMITS.maxTextLen).optional().default("Смените категорию или поиск"),

    menuShopLabel: z.string().trim().max(24).optional().default("Магазин"),
    menuCartLabel: z.string().trim().max(24).optional().default("Корзина"),
    menuOrdersLabel: z.string().trim().max(24).optional().default("Мои заказы"),
    menuFaqLabel: z.string().trim().max(24).optional().default("FAQ"),
  })
  .default({
    heroDefaultTitle: "Добро пожаловать",
    heroDefaultSubtitle: "",
    heroDefaultCta: "",
    addToCartLabel: "Добавить",
    buyNowLabel: "Купить",
    viewAllLabel: "Смотреть всё",
    checkoutLabel: "Оформить",

    titleCategories: "Категории",
    titleHits: "Хиты",
    titleTrending: "Trending",
    titleFaq: "FAQ",
    titleReviews: "Отзывы",

    emptyCartTitle: "Корзина пуста",
    emptyCartHint: "Добавьте товары, чтобы оформить заказ",
    emptyCatalogTitle: "Нет товаров",
    emptyCatalogHint: "Скоро появятся товары",
    emptySearchTitle: "Ничего не найдено",
    emptySearchHint: "Смените категорию или поиск",

    menuShopLabel: "Магазин",
    menuCartLabel: "Корзина",
    menuOrdersLabel: "Мои заказы",
    menuFaqLabel: "FAQ",
  });

const StorefrontStyleConfigSchema = z
  .object({
    layout: z
      .object({
        density: z.enum(["compact", "normal", "comfortable"]).default("normal"),
        sectionSpacing: z.number().int().min(0).max(48).default(16),
        productGap: z.number().int().min(0).max(32).default(10),
        mobilePadding: z.number().int().min(0).max(28).default(10),
        contentWidth: z.enum(["full", "narrow"]).default("full"),
      })
      .default({
        density: "normal",
        sectionSpacing: 16,
        productGap: 10,
        mobilePadding: 10,
        contentWidth: "full",
      }),
    typography: z
      .object({
        fontBody: z
          .enum(["system", "inter", "poppins", "manrope", "montserrat", "bebasNeue", "playfairDisplay"])
          .default("system"),
        fontTitle: z
          .enum(["system", "inter", "poppins", "manrope", "montserrat", "bebasNeue", "playfairDisplay"])
          .default("system"),
        fontButton: z
          .enum(["system", "inter", "poppins", "manrope", "montserrat", "bebasNeue", "playfairDisplay"])
          .default("system"),
        titleSize: z.number().int().min(14).max(44).default(24),
        sectionTitleSize: z.number().int().min(12).max(28).default(16),
        buttonSize: z.number().int().min(10).max(20).default(13),
        titleWeight: z.number().int().min(400).max(900).default(800),
        uppercaseTitles: z.boolean().default(false),
        letterSpacing: z.number().min(-0.06).max(0.5).default(0),
        lineHeight: z.number().min(1).max(1.8).default(1.15),
      })
      .default({
        fontBody: "system",
        fontTitle: "system",
        fontButton: "system",
        titleSize: 24,
        sectionTitleSize: 16,
        buttonSize: 13,
        titleWeight: 800,
        uppercaseTitles: false,
        letterSpacing: 0,
        lineHeight: 1.15,
      }),
    chips: z
      .object({
        shape: z.enum(["pill", "square"]).default("pill"),
        style: z.enum(["outline", "filled"]).default("outline"),
        size: z.enum(["sm", "md", "lg"]).default("md"),
        radius: z.number().int().min(0).max(32).default(999),
        gap: z.number().int().min(0).max(20).default(8),
      })
      .default({
        shape: "pill",
        style: "outline",
        size: "md",
        radius: 999,
        gap: 8,
      }),
    buttons: z
      .object({
        radius: z.number().int().min(0).max(32).default(14),
        height: z.number().int().min(32).max(60).default(44),
        shadow: z.boolean().default(true),
        glow: z.boolean().default(false),
        variant: z.enum(["filled", "outline"]).default("filled"),
        compact: z.boolean().default(false),
        animationLevel: z.enum(["off", "low", "high"]).default("low"),
      })
      .default({
        radius: 14,
        height: 44,
        shadow: true,
        glow: false,
        variant: "filled",
        compact: false,
        animationLevel: "low",
      }),
    hero: z
      .object({
        layout: z.enum(["centered", "split", "banner"]).default("centered"),
        overlay: z.boolean().default(false),
        height: z.number().int().min(160).max(520).default(320),
        radius: z.number().int().min(0).max(40).default(24),
        shadow: z.boolean().default(false),
        alignment: z.enum(["left", "center"]).default("center"),
        ctaPosition: z.enum(["below", "overlay", "hidden"]).default("below"),
      })
      .default({
        layout: "centered",
        overlay: false,
        height: 320,
        radius: 24,
        shadow: false,
        alignment: "center",
        ctaPosition: "below",
      }),
  })
  .default({
    layout: {
      density: "normal",
      sectionSpacing: 16,
      productGap: 10,
      mobilePadding: 10,
      contentWidth: "full",
    },
    typography: {
      fontBody: "system",
      fontTitle: "system",
      fontButton: "system",
      titleSize: 24,
      sectionTitleSize: 16,
      buttonSize: 13,
      titleWeight: 800,
      uppercaseTitles: false,
      letterSpacing: 0,
      lineHeight: 1.15,
    },
    chips: {
      shape: "pill",
      style: "outline",
      size: "md",
      radius: 999,
      gap: 8,
    },
    buttons: {
      radius: 14,
      height: 44,
      shadow: true,
      glow: false,
      variant: "filled",
      compact: false,
      animationLevel: "low",
    },
    hero: {
      layout: "centered",
      overlay: false,
      height: 320,
      radius: 24,
      shadow: false,
      alignment: "center",
      ctaPosition: "below",
    },
  });

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
    storefrontHeaderConfig: StorefrontHeaderConfigSchema.optional(),
    storefrontCardConfig: StorefrontCardConfigSchema.optional(),
    storefrontTextConfig: StorefrontTextConfigSchema.optional(),
    storefrontStyleConfig: StorefrontStyleConfigSchema.optional(),
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
  if (version === toVersion)
    return {
      version: toVersion,
      sections: v.sections as any,
      storefrontHeaderConfig: (v as any).storefrontHeaderConfig,
      storefrontCardConfig: (v as any).storefrontCardConfig,
      storefrontTextConfig: (v as any).storefrontTextConfig,
      storefrontStyleConfig: (v as any).storefrontStyleConfig,
    };

  // future migrations: add here
  return {
    version: toVersion,
    sections: v.sections as any,
    storefrontHeaderConfig: (v as any).storefrontHeaderConfig,
    storefrontCardConfig: (v as any).storefrontCardConfig,
    storefrontTextConfig: (v as any).storefrontTextConfig,
    storefrontStyleConfig: (v as any).storefrontStyleConfig,
  };
}

export function defaultStorefrontConfig(): RawStorefrontConfig {
  return {
    version: CURRENT_STOREFRONT_VERSION,
    sections: defaultSections(),
    storefrontHeaderConfig: StorefrontHeaderConfigSchema.parse({}),
    storefrontCardConfig: StorefrontCardConfigSchema.parse({}),
    storefrontTextConfig: StorefrontTextConfigSchema.parse({}),
    storefrontStyleConfig: StorefrontStyleConfigSchema.parse({}),
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

  const headerCfg =
    StorefrontHeaderConfigSchema.safeParse((migrated as any).storefrontHeaderConfig ?? undefined)
      .success
      ? StorefrontHeaderConfigSchema.parse((migrated as any).storefrontHeaderConfig ?? {})
      : StorefrontHeaderConfigSchema.parse({});

  const cardCfg =
    StorefrontCardConfigSchema.safeParse((migrated as any).storefrontCardConfig ?? undefined)
      .success
      ? StorefrontCardConfigSchema.parse((migrated as any).storefrontCardConfig ?? {})
      : StorefrontCardConfigSchema.parse({});

  const textCfg =
    StorefrontTextConfigSchema.safeParse((migrated as any).storefrontTextConfig ?? undefined).success
      ? StorefrontTextConfigSchema.parse((migrated as any).storefrontTextConfig ?? {})
      : StorefrontTextConfigSchema.parse({});

  const styleCfg =
    StorefrontStyleConfigSchema.safeParse((migrated as any).storefrontStyleConfig ?? undefined).success
      ? StorefrontStyleConfigSchema.parse((migrated as any).storefrontStyleConfig ?? {})
      : StorefrontStyleConfigSchema.parse({});

  return {
    businessId: input.businessId,
    businessType: input.businessType,
    templateId: input.templateId,
    theme: resolveStoreTheme(input.templateId, input.rawThemeConfig),
    featureFlags: resolveFeatureFlags(input.rawFeatureFlags),
    storefrontConfigVersion: CURRENT_STOREFRONT_VERSION,
    sections: sectionsResolved,
    storefrontHeaderConfig: headerCfg,
    storefrontCardConfig: cardCfg,
    storefrontTextConfig: textCfg,
    storefrontStyleConfig: styleCfg,
  };
}

