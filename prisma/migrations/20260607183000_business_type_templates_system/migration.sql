-- Manual migration (generated without DB access).
-- Adds BusinessType + businessType fields, category tree, and JSON config columns.

-- 1) Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BusinessType') THEN
    CREATE TYPE "BusinessType" AS ENUM ('clothing', 'coffee', 'fastfood', 'flowers');
  END IF;
END$$;

-- 2) Business
ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "businessType" "BusinessType" NOT NULL DEFAULT 'clothing',
  ADD COLUMN IF NOT EXISTS "merchantConfig" JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3) RegistrationRequest
ALTER TABLE "RegistrationRequest"
  ADD COLUMN IF NOT EXISTS "businessType" "BusinessType" NOT NULL DEFAULT 'clothing';

-- 4) Category: tree + config
ALTER TABLE "Category"
  ADD COLUMN IF NOT EXISTS "parentId" INTEGER,
  ADD COLUMN IF NOT EXISTS "config" JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Category_parentId_fkey'
  ) THEN
    ALTER TABLE "Category"
      ADD CONSTRAINT "Category_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "Category_businessId_parentId_idx" ON "Category"("businessId", "parentId");
CREATE INDEX IF NOT EXISTS "Category_parentId_idx" ON "Category"("parentId");

-- Make category name unique per parent (allow same name under different branches)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Category_businessId_name_key'
  ) THEN
    ALTER TABLE "Category" DROP CONSTRAINT "Category_businessId_name_key";
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Category_businessId_parentId_name_key'
  ) THEN
    ALTER TABLE "Category"
      ADD CONSTRAINT "Category_businessId_parentId_name_key" UNIQUE ("businessId", "parentId", "name");
  END IF;
END$$;

-- 5) Product attributes
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "attributes" JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 6) OrderItem options
ALTER TABLE "OrderItem"
  ADD COLUMN IF NOT EXISTS "options" JSONB NOT NULL DEFAULT '{}'::jsonb;

