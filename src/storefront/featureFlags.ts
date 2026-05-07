import { z } from "zod";

export const FeatureFlagsSchema = z
  .object({
    enableStories: z.boolean().optional(),
    enableReviews: z.boolean().optional(),
    enableVideo: z.boolean().optional(),
  })
  .passthrough();

export type ResolvedFeatureFlags = {
  enableStories: boolean;
  enableReviews: boolean;
  enableVideo: boolean;
};

export function resolveFeatureFlags(raw: unknown): ResolvedFeatureFlags {
  const parsed = FeatureFlagsSchema.safeParse(raw);
  const v = parsed.success ? parsed.data : {};
  return {
    enableStories: Boolean((v as any).enableStories),
    enableReviews: Boolean((v as any).enableReviews),
    enableVideo: Boolean((v as any).enableVideo),
  };
}

