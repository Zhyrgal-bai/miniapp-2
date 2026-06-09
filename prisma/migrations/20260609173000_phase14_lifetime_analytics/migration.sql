-- Phase 14: merchant lifetime analytics isolated from order history cleanup

CREATE TABLE IF NOT EXISTS "MerchantLifetimeAnalytics" (
    "businessId" INTEGER NOT NULL,
    "createdOrders" INTEGER NOT NULL DEFAULT 0,
    "successfulOrders" INTEGER NOT NULL DEFAULT 0,
    "successfulRevenue" INTEGER NOT NULL DEFAULT 0,
    "completedOrders" INTEGER NOT NULL DEFAULT 0,
    "cancelledOrders" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantLifetimeAnalytics_pkey" PRIMARY KEY ("businessId")
);

CREATE TABLE IF NOT EXISTS "MerchantLifetimeOrderState" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "businessId" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "countedRevenue" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantLifetimeOrderState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MerchantLifetimeOrderState_orderId_key"
  ON "MerchantLifetimeOrderState"("orderId");
CREATE INDEX IF NOT EXISTS "MerchantLifetimeOrderState_businessId_idx"
  ON "MerchantLifetimeOrderState"("businessId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MerchantLifetimeAnalytics_businessId_fkey'
  ) THEN
    ALTER TABLE "MerchantLifetimeAnalytics"
      ADD CONSTRAINT "MerchantLifetimeAnalytics_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MerchantLifetimeOrderState_businessId_fkey'
  ) THEN
    ALTER TABLE "MerchantLifetimeOrderState"
      ADD CONSTRAINT "MerchantLifetimeOrderState_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
