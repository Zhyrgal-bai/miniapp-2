-- CreateEnum
CREATE TYPE "DeliveryTimelineKind" AS ENUM ('ORDER_CREATED', 'PAYMENT_CONFIRMED', 'OFFER_CALCULATED', 'CLAIM_CREATED', 'CLAIM_ACCEPTED', 'STATUS_CHANGED', 'COURIER_ASSIGNED', 'COURIER_ARRIVED', 'PICKED_UP', 'DELIVERING', 'DELIVERED', 'CANCELLED', 'FAILED', 'RECOVERY_STARTED', 'RECOVERY_RETRY', 'RECOVERY_RESOLVED', 'MANUAL_REFRESH', 'MANUAL_RETRY', 'FORCE_REFRESH', 'WEBHOOK_RECEIVED');

-- CreateEnum
CREATE TYPE "DeliveryAuditActor" AS ENUM ('SYSTEM', 'WEBHOOK', 'RECOVERY', 'MERCHANT', 'PLATFORM_OPERATOR');

-- CreateTable
CREATE TABLE "DeliveryTimelineEvent" (
    "id" SERIAL NOT NULL,
    "providerDeliveryId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "businessId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "kind" "DeliveryTimelineKind" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "metadata" JSONB,
    "actor" "DeliveryAuditActor" NOT NULL DEFAULT 'SYSTEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAuditLog" (
    "id" SERIAL NOT NULL,
    "providerDeliveryId" INTEGER,
    "orderId" INTEGER,
    "businessId" INTEGER,
    "provider" TEXT,
    "actor" "DeliveryAuditActor" NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryTimelineEvent_providerDeliveryId_createdAt_idx" ON "DeliveryTimelineEvent"("providerDeliveryId", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryTimelineEvent_orderId_createdAt_idx" ON "DeliveryTimelineEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryTimelineEvent_businessId_createdAt_idx" ON "DeliveryTimelineEvent"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryAuditLog_providerDeliveryId_createdAt_idx" ON "DeliveryAuditLog"("providerDeliveryId", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryAuditLog_orderId_createdAt_idx" ON "DeliveryAuditLog"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryAuditLog_businessId_createdAt_idx" ON "DeliveryAuditLog"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryAuditLog_action_createdAt_idx" ON "DeliveryAuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "DeliveryTimelineEvent" ADD CONSTRAINT "DeliveryTimelineEvent_providerDeliveryId_fkey" FOREIGN KEY ("providerDeliveryId") REFERENCES "ProviderDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
