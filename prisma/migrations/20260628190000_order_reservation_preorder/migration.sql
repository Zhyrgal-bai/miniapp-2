-- Phase 6B: link orders to confirmed table reservations (preorder foundation).
ALTER TABLE "Order" ADD COLUMN "reservationId" INTEGER;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "TableReservation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Order_reservationId_idx" ON "Order"("reservationId");
CREATE INDEX "Order_businessId_reservationId_idx" ON "Order"("businessId", "reservationId");
