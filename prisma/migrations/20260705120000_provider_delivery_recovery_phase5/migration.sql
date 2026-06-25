-- Phase 5: delivery recovery / dead-letter

ALTER TYPE "ProviderDeliveryStatus" ADD VALUE 'RECOVERY_REQUIRED';

ALTER TABLE "ProviderDelivery" ADD COLUMN "recoveryRetryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProviderDelivery" ADD COLUMN "recoveryNextRetryAt" TIMESTAMP(3);
ALTER TABLE "ProviderDelivery" ADD COLUMN "recoveryLastError" TEXT;

CREATE INDEX "ProviderDelivery_status_recoveryNextRetryAt_idx" ON "ProviderDelivery"("status", "recoveryNextRetryAt");
