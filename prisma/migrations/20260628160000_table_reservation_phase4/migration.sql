-- Phase 4: reservation lifecycle + guest notifications
ALTER TYPE "TableReservationStatus" ADD VALUE IF NOT EXISTS 'ARRIVED';
ALTER TYPE "TableReservationStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW';

ALTER TABLE "TableReservation" ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER NOT NULL DEFAULT 90;
ALTER TABLE "TableReservation" ADD COLUMN IF NOT EXISTS "guestTelegramId" TEXT;
ALTER TABLE "TableReservation" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
ALTER TABLE "TableReservation" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "TableReservation_guestTelegramId_idx" ON "TableReservation"("guestTelegramId");
