-- Phase 6C: reservation preorder payment statuses on Order.
CREATE TYPE "ReservationPreorderStatus" AS ENUM (
  'PREORDER_DRAFT',
  'PREORDER_PAYMENT_PENDING',
  'PREORDER_PAID',
  'PREORDER_CANCELLED'
);

ALTER TABLE "Order" ADD COLUMN "preorderStatus" "ReservationPreorderStatus";

CREATE INDEX "Order_businessId_preorderStatus_idx" ON "Order"("businessId", "preorderStatus");
