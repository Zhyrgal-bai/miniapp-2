import { z } from "zod";

export const FeatureFlagsSchema = z
  .object({
    enableStories: z.boolean().optional(),
    enableReviews: z.boolean().optional(),
    enableVideo: z.boolean().optional(),
    enableProductModalV3: z.boolean().optional(),
    enableLifetimeAnalyticsV2: z.boolean().optional(),
  })
  .passthrough();

export type ResolvedFeatureFlags = {
  enableStories: boolean;
  enableReviews: boolean;
  enableVideo: boolean;
  enableProductModalV3: boolean;
  enableLifetimeAnalyticsV2: boolean;
};

export function resolveFeatureFlags(raw: unknown): ResolvedFeatureFlags {
  const parsed = FeatureFlagsSchema.safeParse(raw);
  const v = parsed.success ? parsed.data : {};
  return {
    enableStories: Boolean((v as any).enableStories),
    enableReviews: Boolean((v as any).enableReviews),
    enableVideo: Boolean((v as any).enableVideo),
    // Guarded rollout boundaries: enabled by default, can be turned off per-tenant.
    enableProductModalV3: (v as any).enableProductModalV3 !== false,
    enableLifetimeAnalyticsV2: (v as any).enableLifetimeAnalyticsV2 !== false,
  };
}

