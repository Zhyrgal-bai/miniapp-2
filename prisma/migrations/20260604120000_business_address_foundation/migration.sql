-- Business address foundation (Phase 1): storefront, delivery, maps prep

ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "addressLine" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

ALTER TABLE "RegistrationRequest" ADD COLUMN IF NOT EXISTS "addressLine" TEXT;
ALTER TABLE "RegistrationRequest" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "RegistrationRequest" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "RegistrationRequest" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
