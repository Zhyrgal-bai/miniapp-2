-- Category names must be unique per parent, not globally per business.
-- Init migration created UNIQUE INDEX "Category_businessId_name_key" (global).
-- Later migration dropped CONSTRAINT with the same name, but the index could remain.

DROP INDEX IF EXISTS "Category_businessId_name_key";

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
      ADD CONSTRAINT "Category_businessId_parentId_name_key"
      UNIQUE ("businessId", "parentId", "name");
  END IF;
END$$;
