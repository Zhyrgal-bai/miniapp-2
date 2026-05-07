-- Stage 3: Storefront engine fields on Business

ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "storefrontConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "storefrontConfigVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "featureFlags" JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS "Business_storefrontConfigVersion_idx" ON "Business"("storefrontConfigVersion");

