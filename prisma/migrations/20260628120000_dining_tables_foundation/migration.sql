-- CreateEnum
CREATE TYPE "DiningTableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'SOON_OCCUPIED');

-- CreateEnum
CREATE TYPE "TableReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "DiningTable" (
    "id" SERIAL NOT NULL,
    "businessId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 2,
    "posX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 0.12,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 0.12,
    "status" "DiningTableStatus" NOT NULL DEFAULT 'AVAILABLE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiningTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableReservation" (
    "id" SERIAL NOT NULL,
    "businessId" INTEGER NOT NULL,
    "tableId" INTEGER NOT NULL,
    "reservedAt" TIMESTAMP(3) NOT NULL,
    "partySize" INTEGER,
    "guestName" TEXT,
    "guestPhone" TEXT,
    "guestNote" TEXT,
    "status" "TableReservationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiningTable_businessId_isActive_idx" ON "DiningTable"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "TableReservation_businessId_reservedAt_idx" ON "TableReservation"("businessId", "reservedAt");

-- CreateIndex
CREATE INDEX "TableReservation_tableId_reservedAt_idx" ON "TableReservation"("tableId", "reservedAt");

-- CreateIndex
CREATE INDEX "TableReservation_businessId_status_idx" ON "TableReservation"("businessId", "status");

-- AddForeignKey
ALTER TABLE "DiningTable" ADD CONSTRAINT "DiningTable_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableReservation" ADD CONSTRAINT "TableReservation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableReservation" ADD CONSTRAINT "TableReservation_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "DiningTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
