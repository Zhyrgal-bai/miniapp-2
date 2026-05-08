-- Stage 4: Visual Storefront Builder (draft/publish)
-- Adds draft + published storefront configs on Business.

ALTER TABLE "Business"
ADD COLUMN IF NOT EXISTS "storefrontDraftConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS "storefrontPublishedConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS "storefrontPublishedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "storefrontDraftUpdatedAt" TIMESTAMP(3);

-- Backfill: preserve current storefrontConfig as published (if present).
UPDATE "Business"
SET
  "storefrontPublishedConfig" = COALESCE("storefrontConfig", '{}'::jsonb),
  "storefrontPublishedAt" = COALESCE("storefrontPublishedAt", NOW())
WHERE
  ("storefrontPublishedConfig" = '{}'::jsonb OR "storefrontPublishedConfig" IS NULL)
  AND "storefrontConfig" IS NOT NULL
  AND "storefrontConfig" <> '{}'::jsonb;

-- Initialize draft from published where draft is still empty.
UPDATE "Business"
SET
  "storefrontDraftConfig" = COALESCE("storefrontPublishedConfig", '{}'::jsonb),
  "storefrontDraftUpdatedAt" = NOW()
WHERE
  ("storefrontDraftConfig" = '{}'::jsonb OR "storefrontDraftConfig" IS NULL)
  AND "storefrontPublishedConfig" IS NOT NULL
  AND "storefrontPublishedConfig" <> '{}'::jsonb;
