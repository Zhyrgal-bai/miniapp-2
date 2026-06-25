-- Phase 4: delivery tracking — extend status enum, tracking columns, order mirror, event history

-- AlterEnum
ALTER TYPE "ProviderDeliveryStatus" ADD VALUE 'COURIER_ASSIGNED';
ALTER TYPE "ProviderDeliveryStatus" ADD VALUE 'COURIER_AT_PICKUP';
ALTER TYPE "ProviderDeliveryStatus" ADD VALUE 'PICKED_UP';
ALTER TYPE "ProviderDeliveryStatus" ADD VALUE 'DELIVERING';
ALTER TYPE "ProviderDeliveryStatus" ADD VALUE 'DELIVERED';
ALTER TYPE "ProviderDeliveryStatus" ADD VALUE 'CANCELLED';

-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN "deliveryStatus" "ProviderDeliveryStatus";

-- AlterTable ProviderDelivery
ALTER TABLE "ProviderDelivery" ADD COLUMN "providerStatus" TEXT;
ALTER TABLE "ProviderDelivery" ADD COLUMN "providerUpdatedAt" TIMESTAMP(3);
ALTER TABLE "ProviderDelivery" ADD COLUMN "courierName" TEXT;
ALTER TABLE "ProviderDelivery" ADD COLUMN "courierPhone" TEXT;
ALTER TABLE "ProviderDelivery" ADD COLUMN "vehicleNumber" TEXT;
ALTER TABLE "ProviderDelivery" ADD COLUMN "etaMinutes" INTEGER;
ALTER TABLE "ProviderDelivery" ADD COLUMN "trackingUrl" TEXT;
ALTER TABLE "ProviderDelivery" ADD COLUMN "courierLat" DOUBLE PRECISION;
ALTER TABLE "ProviderDelivery" ADD COLUMN "courierLng" DOUBLE PRECISION;
ALTER TABLE "ProviderDelivery" ADD COLUMN "lastWebhookKey" TEXT;

-- CreateTable ProviderDeliveryStatusEvent
CREATE TABLE "ProviderDeliveryStatusEvent" (
    "id" SERIAL NOT NULL,
    "providerDeliveryId" INTEGER NOT NULL,
    "providerStatus" TEXT NOT NULL,
    "internalStatus" "ProviderDeliveryStatus" NOT NULL,
    "providerUpdatedAt" TIMESTAMP(3) NOT NULL,
    "webhookKey" TEXT NOT NULL,
    "courierName" TEXT,
    "vehicleNumber" TEXT,
    "etaMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderDeliveryStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeliveryStatusEvent_webhookKey_key" ON "ProviderDeliveryStatusEvent"("webhookKey");
CREATE INDEX "ProviderDeliveryStatusEvent_providerDeliveryId_idx" ON "ProviderDeliveryStatusEvent"("providerDeliveryId");
CREATE INDEX "ProviderDeliveryStatusEvent_providerDeliveryId_providerUpdatedAt_idx" ON "ProviderDeliveryStatusEvent"("providerDeliveryId", "providerUpdatedAt");
CREATE INDEX "Order_businessId_deliveryStatus_idx" ON "Order"("businessId", "deliveryStatus");

-- AddForeignKey
ALTER TABLE "ProviderDeliveryStatusEvent" ADD CONSTRAINT "ProviderDeliveryStatusEvent_providerDeliveryId_fkey" FOREIGN KEY ("providerDeliveryId") REFERENCES "ProviderDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
