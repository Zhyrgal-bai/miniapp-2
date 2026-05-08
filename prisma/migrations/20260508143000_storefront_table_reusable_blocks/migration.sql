-- Stage 6: Storefront table + reusable blocks (foundation for multi-storefront)

CREATE TABLE IF NOT EXISTS "Storefront" (
  "id" SERIAL PRIMARY KEY,
  "businessId" INTEGER NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Main',
  "slug" TEXT,
  "draftConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "publishedConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "Storefront_businessId_idx" ON "Storefront" ("businessId");
CREATE INDEX IF NOT EXISTS "Storefront_businessId_slug_idx" ON "Storefront" ("businessId", "slug");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Storefront_businessId_fkey'
  ) THEN
    ALTER TABLE "Storefront"
      ADD CONSTRAINT "Storefront_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "StorefrontReusableBlock" (
  "id" SERIAL PRIMARY KEY,
  "businessId" INTEGER NOT NULL,
  "storefrontId" INTEGER,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "config" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "StorefrontReusableBlock_businessId_idx" ON "StorefrontReusableBlock" ("businessId");
CREATE INDEX IF NOT EXISTS "StorefrontReusableBlock_storefrontId_idx" ON "StorefrontReusableBlock" ("storefrontId");
CREATE INDEX IF NOT EXISTS "StorefrontReusableBlock_businessId_type_idx" ON "StorefrontReusableBlock" ("businessId", "type");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StorefrontReusableBlock_businessId_fkey'
  ) THEN
    ALTER TABLE "StorefrontReusableBlock"
      ADD CONSTRAINT "StorefrontReusableBlock_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StorefrontReusableBlock_storefrontId_fkey'
  ) THEN
    ALTER TABLE "StorefrontReusableBlock"
      ADD CONSTRAINT "StorefrontReusableBlock_storefrontId_fkey"
      FOREIGN KEY ("storefrontId") REFERENCES "Storefront"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill: ensure each Business has a default Storefront row.
INSERT INTO "Storefront" ("businessId", "name", "draftConfig", "publishedConfig", "publishedAt")
SELECT
  b."id" AS "businessId",
  'Main' AS "name",
  COALESCE(b."storefrontDraftConfig", '{}'::jsonb) AS "draftConfig",
  COALESCE(b."storefrontPublishedConfig", b."storefrontConfig", '{}'::jsonb) AS "publishedConfig",
  COALESCE(b."storefrontPublishedAt", NOW()) AS "publishedAt"
FROM "Business" b
WHERE NOT EXISTS (
  SELECT 1 FROM "Storefront" s WHERE s."businessId" = b."id"
);

