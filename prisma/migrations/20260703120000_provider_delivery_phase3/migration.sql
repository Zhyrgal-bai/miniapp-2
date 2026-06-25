-- Phase 3: platform provider delivery claims (Yandex etc.)

CREATE TYPE "ProviderDeliveryStatus" AS ENUM ('NEW', 'CREATED', 'ACCEPTED', 'SEARCHING_COURIER', 'FAILED');

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryOfferId" TEXT;

CREATE TABLE IF NOT EXISTS "ProviderDelivery" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "businessId" INTEGER NOT NULL,
    "buyerUserId" INTEGER,
    "provider" TEXT NOT NULL,
    "providerClaimId" TEXT,
    "providerOfferId" TEXT NOT NULL,
    "price" INTEGER,
    "currency" TEXT,
    "status" "ProviderDeliveryStatus" NOT NULL DEFAULT 'NEW',
    "providerPayload" JSONB,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderDelivery_orderId_key" ON "ProviderDelivery"("orderId");
CREATE INDEX IF NOT EXISTS "ProviderDelivery_businessId_idx" ON "ProviderDelivery"("businessId");
CREATE INDEX IF NOT EXISTS "ProviderDelivery_businessId_status_idx" ON "ProviderDelivery"("businessId", "status");
CREATE INDEX IF NOT EXISTS "ProviderDelivery_providerClaimId_idx" ON "ProviderDelivery"("providerClaimId");
CREATE INDEX IF NOT EXISTS "Order_deliveryOfferId_idx" ON "Order"("deliveryOfferId");

ALTER TABLE "ProviderDelivery" ADD CONSTRAINT "ProviderDelivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderDelivery" ADD CONSTRAINT "ProviderDelivery_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderDelivery" ADD CONSTRAINT "ProviderDelivery_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
