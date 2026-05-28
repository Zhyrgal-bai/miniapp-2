-- CreateEnum
CREATE TYPE "DiningTableShape" AS ENUM ('SQUARE', 'RECTANGLE', 'CIRCLE', 'VIP');

-- AlterTable
ALTER TABLE "DiningTable" ADD COLUMN "shape" "DiningTableShape" NOT NULL DEFAULT 'RECTANGLE';
ALTER TABLE "DiningTable" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
