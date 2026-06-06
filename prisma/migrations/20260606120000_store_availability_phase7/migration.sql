-- Phase 7: store schedule, ETA, delivery zones
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "storeAvailabilitySettings" JSONB DEFAULT '{}';
