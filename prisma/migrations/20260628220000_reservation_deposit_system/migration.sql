-- Phase 6E: reservation deposit system.

CREATE TYPE "ReservationDepositStatus" AS ENUM (
  'NONE',
  'DEPOSIT_PENDING',
  'DEPOSIT_PAID',
  'DEPOSIT_EXPIRED'
);

ALTER TABLE "TableReservation"
  ADD COLUMN "depositStatus" "ReservationDepositStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "depositAmount" INTEGER,
  ADD COLUMN "depositPaidAt" TIMESTAMP(3),
  ADD COLUMN "depositPaymentId" TEXT,
  ADD COLUMN "depositDueAt" TIMESTAMP(3);

CREATE INDEX "TableReservation_depositStatus_depositDueAt_idx"
  ON "TableReservation"("depositStatus", "depositDueAt");
