import { z } from "zod";

const SectionTypeSchema = z.enum([
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
]);

const ResolvedStorefrontSectionSchema = z.object({
  id: z.string(),
  type: SectionTypeSchema,
  order: z.number(),
  config: z.record(z.string(), z.unknown()),
});

const BannerSchema = z.object({
  enabled: z.boolean(),
  title: z.string(),
  subtitle: z.string(),
});

/** Wire shape for `theme` on GET /api/storefront — strict on core fields, forward-compatible. */
const ResolvedStoreThemeWireSchema = z
  .object({
    primaryColor: z.string(),
    bgColor: z.string(),
    cardColor: z.string(),
    textColor: z.string(),
    logoUrl: z.string().nullable(),
    layout: z.enum(["classic", "modern"]),
    banner: BannerSchema,
    tokens: z.record(z.string(), z.unknown()),
    tokensV3: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const ResolvedFeatureFlagsWireSchema = z.object({
  enableStories: z.boolean(),
  enableReviews: z.boolean(),
  enableVideo: z.boolean(),
  enableProductModalV3: z.boolean(),
  enableLifetimeAnalyticsV2: z.boolean(),
});

export type CategoryTreeNode = {
  id: number;
  name: string;
  parentId: number | null;
  children: CategoryTreeNode[];
};

const CategoryTreeNodeSchema: z.ZodType<CategoryTreeNode> = z.lazy(() =>
  z.object({
    id: z.number(),
    name: z.string(),
    parentId: z.number().nullable(),
    children: z.array(CategoryTreeNodeSchema),
  }),
);

const FeaturedPromoWireSchema = z.object({
  code: z.string(),
  discount: z.number(),
  remainingUses: z.number().int().nonnegative(),
});

const StoreAddressWireSchema = z.object({
  addressLine: z.string(),
  city: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

const DeliveryDistanceTierWireSchema = z.object({
  maxKm: z.number().nullable(),
  priceSom: z.number(),
});

const DeliveryPolicyWireSchema = z.object({
  pricingMode: z.enum([
    "SELF_PICKUP",
    "FIXED_PRICE",
    "DISTANCE_BASED",
    "FREE_DELIVERY",
    "MANUAL_CONFIRMATION",
  ]),
  minOrderAmountSom: z.number(),
  fixedPriceSom: z.number(),
  distanceTiers: z.array(DeliveryDistanceTierWireSchema),
  manualConfirmationNotice: z.string().nullable(),
  pickupOnly: z.boolean(),
});

const EtaRangeWireSchema = z.object({
  minMinutes: z.number(),
  maxMinutes: z.number(),
});

const StoreAvailabilityWireSchema = z.object({
  status: z.enum(["OPEN", "CLOSED", "OPENING_SOON", "CLOSING_SOON"]),
  isOpen: z.boolean(),
  label: z.string(),
  detail: z.string(),
  timezone: z.string(),
  deliveryEta: EtaRangeWireSchema,
  pickupEta: EtaRangeWireSchema,
  deliveryZones: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      distanceLabel: z.string(),
      etaLabel: z.string(),
      minKm: z.number(),
      maxKm: z.number().nullable(),
      eta: EtaRangeWireSchema,
    }),
  ),
  pickupEnabled: z.boolean(),
  deliveryEnabled: z.boolean(),
  closedCheckoutNotice: z.string().nullable(),
  nextOpenLabel: z.string().nullable(),
  weeklySchedule: z
    .array(
      z.object({
        dayKey: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
        dayLabel: z.string(),
        hoursLabel: z.string(),
        closed: z.boolean(),
      }),
    )
    .optional(),
});

const TemplateDescriptorWireSchema = z
  .object({
    businessType: z.string(),
    cardRendererId: z.string(),
    modalRendererId: z.string(),
    variantPolicy: z.record(z.string(), z.unknown()).optional(),
    catalogBehavior: z.record(z.string(), z.unknown()).optional(),
    modalBehavior: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const FeaturedProductWireSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    price: z.number(),
    image: z.string().nullable(),
    images: z.array(z.string()),
    description: z.string().nullable(),
    categoryId: z.number(),
    createdAt: z.union([z.string(), z.coerce.date()]).optional(),
    sold30d: z.number().optional(),
    sold: z.number().optional(),
  })
  .passthrough();

/**
 * Validates JSON returned by GET /api/storefront/:businessId (and in-memory cache entries).
 * Keeps `storefrontStyleConfig` etc. as plain objects while still rejecting completely wrong shapes.
 */
export const StorefrontPublicApiResponseSchema = z
  .object({
    businessId: z.number().int(),
    businessType: z.string(),
    templateId: z.string().nullable(),
    theme: ResolvedStoreThemeWireSchema,
    featureFlags: ResolvedFeatureFlagsWireSchema,
    storefrontConfigVersion: z.number(),
    sections: z.array(ResolvedStorefrontSectionSchema),
    storefrontHeaderConfig: z.record(z.string(), z.unknown()),
    storefrontCardConfig: z.record(z.string(), z.unknown()),
    storefrontTextConfig: z.record(z.string(), z.unknown()),
    storefrontStyleConfig: z.record(z.string(), z.unknown()),
    storeName: z.string().max(200).optional(),
    categories: z.array(CategoryTreeNodeSchema).optional(),
    featuredProducts: z.array(FeaturedProductWireSchema).optional(),
    featuredPromo: FeaturedPromoWireSchema.optional(),
    orderOptionsSchema: z.record(z.string(), z.unknown()).optional(),
    templateDescriptor: TemplateDescriptorWireSchema.optional(),
    storeAddress: StoreAddressWireSchema.optional(),
    /** Deep link: t.me/bot?startapp=slug — для CTA «Открыть в Telegram» в веб-витрине. */
    telegramOpenUrl: z.string().url().optional(),
    deliveryPolicy: DeliveryPolicyWireSchema.optional(),
    storeAvailability: StoreAvailabilityWireSchema.optional(),
    deliveryEta: EtaRangeWireSchema.optional(),
    pickupEta: EtaRangeWireSchema.optional(),
    deliveryZones: StoreAvailabilityWireSchema.shape.deliveryZones.optional(),
    finikCheckoutReady: z.boolean().optional(),
    webProfile: z
      .object({
        coverUrl: z.string().nullable(),
        slogan: z.string().nullable(),
        story: z.string().nullable(),
        accentColor: z.string().nullable(),
        social: z.object({
          instagram: z.string().nullable(),
          telegram: z.string().nullable(),
          whatsapp: z.string().nullable(),
          website: z.string().nullable(),
        }),
      })
      .optional(),
  })
  .passthrough();

export type StorefrontPublicApiResponse = z.infer<
  typeof StorefrontPublicApiResponseSchema
>;

export function safeParseStorefrontPublicApiResponse(
  data: unknown,
):
  | { ok: true; data: StorefrontPublicApiResponse }
  | { ok: false; error: string } {
  const r = StorefrontPublicApiResponseSchema.safeParse(data);
  if (!r.success) {
    const detail = r.error.issues
      .map(
        (issue: (typeof r.error.issues)[number]) =>
          `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      )
      .join("; ");
    return { ok: false, error: detail || r.error.message };
  }
  return { ok: true, data: r.data };
}
