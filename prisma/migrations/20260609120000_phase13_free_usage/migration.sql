-- Phase 13: Free Usage Model — quota fields + enum values + idempotency table

ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'FREE';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'QUOTA_EXHAUSTED';

ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "freeOrdersUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "freeOrdersLimit" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "quotaExhaustedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "FreeOrderQuotaEvent" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "businessId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreeOrderQuotaEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FreeOrderQuotaEvent_orderId_key" ON "FreeOrderQuotaEvent"("orderId");
CREATE INDEX IF NOT EXISTS "FreeOrderQuotaEvent_businessId_idx" ON "FreeOrderQuotaEvent"("businessId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FreeOrderQuotaEvent_businessId_fkey'
  ) THEN
    ALTER TABLE "FreeOrderQuotaEvent"
      ADD CONSTRAINT "FreeOrderQuotaEvent_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
