-- Phase 4: flexible merchant delivery settings + order delivery fee

ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "deliverySettings" JSONB DEFAULT '{}';

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryFee" INTEGER NOT NULL DEFAULT 0;
