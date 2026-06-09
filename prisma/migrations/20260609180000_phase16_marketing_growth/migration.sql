-- Phase 16: merchant marketing & growth (promotions, campaigns, loyalty)

CREATE TABLE IF NOT EXISTS "MerchantPromotion" (
    "id" SERIAL NOT NULL,
    "businessId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "percent" INTEGER,
    "fixedAmountSom" INTEGER,
    "minOrderSom" INTEGER NOT NULL DEFAULT 0,
    "giftProductId" INTEGER,
    "buyQuantity" INTEGER,
    "getQuantity" INTEGER,
    "audienceSegment" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT false,
    "maxRedemptions" INTEGER NOT NULL DEFAULT 0,
    "redemptions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantPromotion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MerchantPromotion_businessId_idx" ON "MerchantPromotion"("businessId");
CREATE INDEX IF NOT EXISTS "MerchantPromotion_businessId_active_idx" ON "MerchantPromotion"("businessId", "active");

CREATE TABLE IF NOT EXISTS "MerchantCampaign" (
    "id" SERIAL NOT NULL,
    "businessId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "promotionId" INTEGER,
    "audienceSegment" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "budgetSom" INTEGER NOT NULL DEFAULT 0,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MerchantCampaign_businessId_idx" ON "MerchantCampaign"("businessId");
CREATE INDEX IF NOT EXISTS "MerchantCampaign_businessId_active_idx" ON "MerchantCampaign"("businessId", "active");
CREATE INDEX IF NOT EXISTS "MerchantCampaign_promotionId_idx" ON "MerchantCampaign"("promotionId");

CREATE TABLE IF NOT EXISTS "LoyaltyProgram" (
    "businessId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "pointsPerOrder" INTEGER NOT NULL DEFAULT 10,
    "pointsPerSomSpent" INTEGER NOT NULL DEFAULT 0,
    "redeemThreshold" INTEGER NOT NULL DEFAULT 100,
    "redeemValueSom" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyProgram_pkey" PRIMARY KEY ("businessId")
);

CREATE TABLE IF NOT EXISTS "CustomerLoyaltyState" (
    "id" SERIAL NOT NULL,
    "businessId" INTEGER NOT NULL,
    "customerKey" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "visits" INTEGER NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "lastOrderId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerLoyaltyState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerLoyaltyState_businessId_customerKey_key"
  ON "CustomerLoyaltyState"("businessId", "customerKey");
CREATE INDEX IF NOT EXISTS "CustomerLoyaltyState_businessId_idx" ON "CustomerLoyaltyState"("businessId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MerchantPromotion_businessId_fkey'
  ) THEN
    ALTER TABLE "MerchantPromotion"
      ADD CONSTRAINT "MerchantPromotion_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MerchantCampaign_businessId_fkey'
  ) THEN
    ALTER TABLE "MerchantCampaign"
      ADD CONSTRAINT "MerchantCampaign_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MerchantCampaign_promotionId_fkey'
  ) THEN
    ALTER TABLE "MerchantCampaign"
      ADD CONSTRAINT "MerchantCampaign_promotionId_fkey"
      FOREIGN KEY ("promotionId") REFERENCES "MerchantPromotion"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyProgram_businessId_fkey'
  ) THEN
    ALTER TABLE "LoyaltyProgram"
      ADD CONSTRAINT "LoyaltyProgram_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CustomerLoyaltyState_businessId_fkey'
  ) THEN
    ALTER TABLE "CustomerLoyaltyState"
      ADD CONSTRAINT "CustomerLoyaltyState_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
