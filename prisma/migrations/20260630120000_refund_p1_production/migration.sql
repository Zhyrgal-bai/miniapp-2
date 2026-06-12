-- P1: production refund workflow extensions (additive, backward compatible)

CREATE TYPE "RefundMethod" AS ENUM ('MANUAL', 'FINIK', 'AUTO');

CREATE TYPE "RefundAuditActorType" AS ENUM ('CUSTOMER', 'MERCHANT', 'SYSTEM');

ALTER TABLE "RefundRequest" ADD COLUMN IF NOT EXISTS "refundMethod" "RefundMethod";
ALTER TABLE "RefundRequest" ADD COLUMN IF NOT EXISTS "paymentReference" TEXT;
ALTER TABLE "RefundRequest" ADD COLUMN IF NOT EXISTS "transactionReference" TEXT;
ALTER TABLE "RefundRequest" ADD COLUMN IF NOT EXISTS "refundReference" TEXT;
ALTER TABLE "RefundRequest" ADD COLUMN IF NOT EXISTS "externalReference" TEXT;
ALTER TABLE "RefundRequest" ADD COLUMN IF NOT EXISTS "initiatedByMerchant" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RefundRequest" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "RefundRequest_orderId_status_idx" ON "RefundRequest"("orderId", "status");

CREATE TABLE IF NOT EXISTS "RefundAuditLog" (
    "id" SERIAL NOT NULL,
    "refundRequestId" INTEGER NOT NULL,
    "businessId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "actorType" "RefundAuditActorType" NOT NULL,
    "actorUserId" INTEGER,
    "fromStatus" "RefundRequestStatus",
    "toStatus" "RefundRequestStatus" NOT NULL,
    "refundAmount" INTEGER,
    "refundMethod" "RefundMethod",
    "paymentReference" TEXT,
    "merchantNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RefundAuditLog_refundRequestId_idx" ON "RefundAuditLog"("refundRequestId");
CREATE INDEX IF NOT EXISTS "RefundAuditLog_businessId_createdAt_idx" ON "RefundAuditLog"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "RefundAuditLog_orderId_idx" ON "RefundAuditLog"("orderId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RefundAuditLog_refundRequestId_fkey'
  ) THEN
    ALTER TABLE "RefundAuditLog" ADD CONSTRAINT "RefundAuditLog_refundRequestId_fkey"
      FOREIGN KEY ("refundRequestId") REFERENCES "RefundRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RefundAuditLog_businessId_fkey'
  ) THEN
    ALTER TABLE "RefundAuditLog" ADD CONSTRAINT "RefundAuditLog_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
