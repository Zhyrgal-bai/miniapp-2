-- Operations: inventory ledger, delivery phases, notification kinds, abuse cooldowns

CREATE TYPE "DeliveryMode" AS ENUM ('PICKUP', 'DELIVERY');
CREATE TYPE "DeliveryStage" AS ENUM ('PREPARING', 'COURIER_DISPATCHED', 'OUT_FOR_DELIVERY', 'NEARBY', 'DELIVERED');
CREATE TYPE "StockMovementKind" AS ENUM ('RESERVE', 'RELEASE', 'COMMIT_PAID', 'RESTORE_PAID', 'SHIP', 'RETURN_RECEIVED', 'RESTOCK', 'ADJUST');

ALTER TYPE "MerchantNotificationKind" ADD VALUE IF NOT EXISTS 'ORDER_STATUS';
ALTER TYPE "MerchantNotificationKind" ADD VALUE IF NOT EXISTS 'DELIVERY_UPDATE';
ALTER TYPE "MerchantNotificationKind" ADD VALUE IF NOT EXISTS 'REFUND_REQUEST';
ALTER TYPE "MerchantNotificationKind" ADD VALUE IF NOT EXISTS 'CANCEL_REQUEST';
ALTER TYPE "MerchantNotificationKind" ADD VALUE IF NOT EXISTS 'RETURN_REQUEST';
ALTER TYPE "MerchantNotificationKind" ADD VALUE IF NOT EXISTS 'LOW_STOCK';

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryMode" "DeliveryMode" NOT NULL DEFAULT 'DELIVERY';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "preparationMinutes" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "estimatedDeliveryAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryStage" "DeliveryStage";

CREATE TABLE IF NOT EXISTS "ProductStock" (
  "id" SERIAL NOT NULL,
  "businessId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,
  "size" TEXT NOT NULL DEFAULT '',
  "color" TEXT NOT NULL DEFAULT '',
  "variantKey" TEXT NOT NULL,
  "available" INTEGER NOT NULL DEFAULT 0,
  "reserved" INTEGER NOT NULL DEFAULT 0,
  "paid" INTEGER NOT NULL DEFAULT 0,
  "shipped" INTEGER NOT NULL DEFAULT 0,
  "returned" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductStock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockMovement" (
  "id" SERIAL NOT NULL,
  "businessId" INTEGER NOT NULL,
  "productStockId" INTEGER NOT NULL,
  "orderId" INTEGER,
  "orderItemId" INTEGER,
  "kind" "StockMovementKind" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "meta" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ActionCooldown" (
  "id" SERIAL NOT NULL,
  "businessId" INTEGER NOT NULL,
  "userId" INTEGER,
  "actionKey" TEXT NOT NULL,
  "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActionCooldown_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductStock_businessId_productId_variantKey_key"
  ON "ProductStock"("businessId", "productId", "variantKey");
CREATE INDEX IF NOT EXISTS "ProductStock_businessId_productId_idx"
  ON "ProductStock"("businessId", "productId");

CREATE INDEX IF NOT EXISTS "StockMovement_businessId_createdAt_idx"
  ON "StockMovement"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "StockMovement_productStockId_idx"
  ON "StockMovement"("productStockId");
CREATE INDEX IF NOT EXISTS "StockMovement_orderId_idx"
  ON "StockMovement"("orderId");

CREATE UNIQUE INDEX IF NOT EXISTS "ActionCooldown_businessId_userId_actionKey_key"
  ON "ActionCooldown"("businessId", "userId", "actionKey");
CREATE INDEX IF NOT EXISTS "ActionCooldown_businessId_actionKey_idx"
  ON "ActionCooldown"("businessId", "actionKey");

ALTER TABLE "ProductStock"
  ADD CONSTRAINT "ProductStock_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductStock"
  ADD CONSTRAINT "ProductStock_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_productStockId_fkey"
  FOREIGN KEY ("productStockId") REFERENCES "ProductStock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionCooldown"
  ADD CONSTRAINT "ActionCooldown_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionCooldown"
  ADD CONSTRAINT "ActionCooldown_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
