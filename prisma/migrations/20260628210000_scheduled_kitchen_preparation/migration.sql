-- Phase 6D: scheduled kitchen prep for reservation preorders.

ALTER TYPE "OrderPrepStatus" ADD VALUE 'SCHEDULED';
ALTER TYPE "OrderPrepStatus" ADD VALUE 'READY_FOR_PREP';

ALTER TABLE "Product" ADD COLUMN "preparationMinutes" INTEGER;

ALTER TABLE "Order" ADD COLUMN "kitchenPrepAt" TIMESTAMP(3);

CREATE INDEX "Order_kitchenPrepAt_idx" ON "Order"("kitchenPrepAt");
CREATE INDEX "Order_businessId_prepStatus_kitchenPrepAt_idx"
  ON "Order"("businessId", "prepStatus", "kitchenPrepAt");
