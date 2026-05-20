-- Operations platform foundation: audience events + merchant notifications

CREATE TYPE "StorefrontEventType" AS ENUM ('STORE_VIEW', 'PRODUCT_VIEW', 'ADD_TO_CART', 'CHECKOUT_START');

CREATE TYPE "MerchantNotificationKind" AS ENUM (
  'ORDER_NEW',
  'SUPPORT_MESSAGE',
  'SUPPORT_TICKET',
  'PAYMENT_ISSUE',
  'SUBSCRIPTION_EXPIRING',
  'WEBHOOK_FAILED',
  'SYSTEM'
);

CREATE TABLE "StorefrontEvent" (
    "id" SERIAL NOT NULL,
    "businessId" INTEGER NOT NULL,
    "eventType" "StorefrontEventType" NOT NULL,
    "visitorKey" TEXT NOT NULL,
    "userId" INTEGER,
    "productId" INTEGER,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorefrontEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantNotification" (
    "id" SERIAL NOT NULL,
    "businessId" INTEGER NOT NULL,
    "kind" "MerchantNotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StorefrontEvent_businessId_createdAt_idx" ON "StorefrontEvent"("businessId", "createdAt");
CREATE INDEX "StorefrontEvent_businessId_eventType_createdAt_idx" ON "StorefrontEvent"("businessId", "eventType", "createdAt");
CREATE INDEX "StorefrontEvent_businessId_visitorKey_idx" ON "StorefrontEvent"("businessId", "visitorKey");

CREATE INDEX "MerchantNotification_businessId_readAt_idx" ON "MerchantNotification"("businessId", "readAt");
CREATE INDEX "MerchantNotification_businessId_createdAt_idx" ON "MerchantNotification"("businessId", "createdAt");

ALTER TABLE "StorefrontEvent" ADD CONSTRAINT "StorefrontEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantNotification" ADD CONSTRAINT "MerchantNotification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
