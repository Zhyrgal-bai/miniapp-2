-- ARCHA Phase 6: subscription plans, grace period, payment metadata, manual extensions.

ALTER TABLE "Business" ADD COLUMN "lastReminder7DaysAt" TIMESTAMP(3);
ALTER TABLE "Business" ADD COLUMN "lastReminderAfterExpiryAt" TIMESTAMP(3);
ALTER TABLE "Business" ADD COLUMN "subscriptionPlanCode" TEXT;
ALTER TABLE "Business" ADD COLUMN "autoRenewEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Business" ADD COLUMN "gracePeriodEndsAt" TIMESTAMP(3);
ALTER TABLE "Business" ADD COLUMN "lastAutoRenewAttemptAt" TIMESTAMP(3);

ALTER TABLE "SubscriptionFinikPayment" ADD COLUMN "planCode" TEXT;
ALTER TABLE "SubscriptionFinikPayment" ADD COLUMN "accessDaysGranted" INTEGER;
ALTER TABLE "SubscriptionFinikPayment" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';

CREATE INDEX "SubscriptionFinikPayment_createdAt_idx" ON "SubscriptionFinikPayment"("createdAt");

CREATE TABLE "SubscriptionManualExtension" (
    "id" SERIAL NOT NULL,
    "businessId" INTEGER NOT NULL,
    "operatorTelegramId" TEXT NOT NULL,
    "daysAdded" INTEGER,
    "previousEndsAt" TIMESTAMP(3),
    "newEndsAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionManualExtension_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubscriptionManualExtension_businessId_idx" ON "SubscriptionManualExtension"("businessId");
CREATE INDEX "SubscriptionManualExtension_createdAt_idx" ON "SubscriptionManualExtension"("createdAt");

ALTER TABLE "SubscriptionManualExtension" ADD CONSTRAINT "SubscriptionManualExtension_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
