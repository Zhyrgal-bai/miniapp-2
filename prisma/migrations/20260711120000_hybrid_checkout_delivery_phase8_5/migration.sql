-- Phase 8.5: hybrid checkout delivery metadata on orders
ALTER TABLE "Order" ADD COLUMN "deliveryProvider" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryCalculationSource" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryEtaMinutes" INTEGER;
