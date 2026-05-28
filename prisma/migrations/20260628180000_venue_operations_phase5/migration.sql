-- Phase 5: waiter mode, table sessions, live floor, kitchen prep

ALTER TYPE "BusinessStaffRole" ADD VALUE IF NOT EXISTS 'WAITER';

CREATE TYPE "TableLiveStatus" AS ENUM (
  'FREE',
  'RESERVED',
  'ARRIVED',
  'ORDERING',
  'EATING',
  'PAYMENT',
  'CLEANING'
);

CREATE TYPE "TableSessionStatus" AS ENUM ('ACTIVE', 'PAYMENT_REQUESTED', 'CLOSED');

CREATE TYPE "OrderPrepStatus" AS ENUM ('NONE', 'PREPARING', 'READY', 'SERVED');

ALTER TABLE "DiningTable" ADD COLUMN IF NOT EXISTS "liveStatus" "TableLiveStatus" NOT NULL DEFAULT 'FREE';
ALTER TABLE "DiningTable" ADD COLUMN IF NOT EXISTS "qrToken" TEXT;
ALTER TABLE "DiningTable" ADD COLUMN IF NOT EXISTS "activeSessionId" INTEGER;

UPDATE "DiningTable" SET "qrToken" = 'tbl_' || "id"::text || '_' || substr(md5(random()::text), 1, 12)
WHERE "qrToken" IS NULL;

ALTER TABLE "DiningTable" ALTER COLUMN "qrToken" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "DiningTable_qrToken_key" ON "DiningTable"("qrToken");
CREATE UNIQUE INDEX IF NOT EXISTS "DiningTable_activeSessionId_key" ON "DiningTable"("activeSessionId");
CREATE INDEX IF NOT EXISTS "DiningTable_businessId_liveStatus_idx" ON "DiningTable"("businessId", "liveStatus");

UPDATE "DiningTable" SET "liveStatus" = 'FREE' WHERE "status" = 'AVAILABLE';
UPDATE "DiningTable" SET "liveStatus" = 'RESERVED' WHERE "status" IN ('RESERVED', 'SOON_OCCUPIED');
UPDATE "DiningTable" SET "liveStatus" = 'EATING' WHERE "status" = 'OCCUPIED';

CREATE TABLE "TableSession" (
  "id" SERIAL NOT NULL,
  "businessId" INTEGER NOT NULL,
  "tableId" INTEGER NOT NULL,
  "reservationId" INTEGER,
  "waiterStaffId" INTEGER,
  "partySize" INTEGER,
  "seatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "status" "TableSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "paymentRequestedAt" TIMESTAMP(3),
  "splitBillMeta" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TableSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_tableId_fkey"
  FOREIGN KEY ("tableId") REFERENCES "DiningTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "TableReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_waiterStaffId_fkey"
  FOREIGN KEY ("waiterStaffId") REFERENCES "BusinessStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "TableSession_businessId_status_idx" ON "TableSession"("businessId", "status");
CREATE INDEX "TableSession_tableId_status_idx" ON "TableSession"("tableId", "status");

ALTER TABLE "DiningTable" ADD CONSTRAINT "DiningTable_activeSessionId_fkey"
  FOREIGN KEY ("activeSessionId") REFERENCES "TableSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tableSessionId" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "prepStatus" "OrderPrepStatus" NOT NULL DEFAULT 'NONE';

ALTER TABLE "Order" ADD CONSTRAINT "Order_tableSessionId_fkey"
  FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Order_tableSessionId_idx" ON "Order"("tableSessionId");
CREATE INDEX "Order_businessId_prepStatus_idx" ON "Order"("businessId", "prepStatus");
