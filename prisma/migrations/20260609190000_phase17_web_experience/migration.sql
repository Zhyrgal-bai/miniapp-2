-- Phase 17: web experience — storefront slug alias history (SEO-safe redirects)

CREATE TABLE IF NOT EXISTS "StorefrontSlugAlias" (
    "id" SERIAL NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "businessId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorefrontSlugAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StorefrontSlugAlias_oldSlug_key"
  ON "StorefrontSlugAlias"("oldSlug");
CREATE INDEX IF NOT EXISTS "StorefrontSlugAlias_businessId_idx"
  ON "StorefrontSlugAlias"("businessId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StorefrontSlugAlias_businessId_fkey'
  ) THEN
    ALTER TABLE "StorefrontSlugAlias"
      ADD CONSTRAINT "StorefrontSlugAlias_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
