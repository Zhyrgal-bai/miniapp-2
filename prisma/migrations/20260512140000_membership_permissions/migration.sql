-- AlterTable
ALTER TABLE "Membership" ADD COLUMN "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
