-- Phase 6F: waitlist & smart table queue.

CREATE TYPE "WaitlistEntryStatus" AS ENUM (
  'WAITING',
  'INVITED',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'SEATED',
  'CANCELLED'
);

CREATE TABLE "WaitlistEntry" (
  "id" SERIAL NOT NULL,
  "businessId" INTEGER NOT NULL,
  "partySize" INTEGER NOT NULL,
  "guestName" TEXT NOT NULL,
  "guestPhone" TEXT NOT NULL,
  "guestNote" TEXT,
  "preferredAt" TIMESTAMP(3),
  "guestTelegramId" TEXT,
  "status" "WaitlistEntryStatus" NOT NULL DEFAULT 'WAITING',
  "invitedAt" TIMESTAMP(3),
  "inviteExpiresAt" TIMESTAMP(3),
  "assignedTableId" INTEGER,
  "reservationId" INTEGER,
  "seatedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WaitlistEntry_reservationId_key" ON "WaitlistEntry"("reservationId");
CREATE INDEX "WaitlistEntry_businessId_status_createdAt_idx" ON "WaitlistEntry"("businessId", "status", "createdAt");
CREATE INDEX "WaitlistEntry_businessId_status_idx" ON "WaitlistEntry"("businessId", "status");
CREATE INDEX "WaitlistEntry_assignedTableId_status_idx" ON "WaitlistEntry"("assignedTableId", "status");
CREATE INDEX "WaitlistEntry_guestTelegramId_idx" ON "WaitlistEntry"("guestTelegramId");

ALTER TABLE "WaitlistEntry"
  ADD CONSTRAINT "WaitlistEntry_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WaitlistEntry"
  ADD CONSTRAINT "WaitlistEntry_assignedTableId_fkey"
  FOREIGN KEY ("assignedTableId") REFERENCES "DiningTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WaitlistEntry"
  ADD CONSTRAINT "WaitlistEntry_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "TableReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
