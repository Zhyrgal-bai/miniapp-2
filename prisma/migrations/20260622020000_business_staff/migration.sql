-- CreateEnum
CREATE TYPE "BusinessStaffRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'SUPPORT');

-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramUsername" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;

-- CreateTable BusinessStaff
CREATE TABLE "BusinessStaff" (
    "id" SERIAL NOT NULL,
    "businessId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "BusinessStaffRole" NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "invitedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable StaffInvite
CREATE TABLE "StaffInvite" (
    "id" SERIAL NOT NULL,
    "businessId" INTEGER NOT NULL,
    "telegramUsername" TEXT NOT NULL,
    "role" "BusinessStaffRole" NOT NULL DEFAULT 'ADMIN',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invitedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "StaffInvite_pkey" PRIMARY KEY ("id")
);

-- Migrate existing OWNER/ADMIN memberships into BusinessStaff
INSERT INTO "BusinessStaff" ("businessId", "userId", "role", "permissions", "createdAt", "updatedAt")
SELECT
    m."businessId",
    m."userId",
    CASE WHEN m."role" = 'OWNER' THEN 'OWNER'::"BusinessStaffRole" ELSE 'ADMIN'::"BusinessStaffRole" END,
    COALESCE(m."permissions", ARRAY[]::TEXT[]),
    m."createdAt",
    m."updatedAt"
FROM "Membership" m
WHERE m."role" IN ('OWNER', 'ADMIN')
ON CONFLICT ("userId", "businessId") DO NOTHING;

-- Demote legacy staff rows in Membership so customers-only boundary holds
UPDATE "Membership" SET "role" = 'CLIENT' WHERE "role" IN ('OWNER', 'ADMIN');

-- CreateIndex
CREATE UNIQUE INDEX "BusinessStaff_userId_businessId_key" ON "BusinessStaff"("userId", "businessId");
CREATE INDEX "BusinessStaff_businessId_idx" ON "BusinessStaff"("businessId");
CREATE INDEX "BusinessStaff_userId_idx" ON "BusinessStaff"("userId");

CREATE INDEX "StaffInvite_businessId_status_idx" ON "StaffInvite"("businessId", "status");
CREATE INDEX "StaffInvite_telegramUsername_idx" ON "StaffInvite"("telegramUsername");

-- AddForeignKey
ALTER TABLE "BusinessStaff" ADD CONSTRAINT "BusinessStaff_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessStaff" ADD CONSTRAINT "BusinessStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessStaff" ADD CONSTRAINT "BusinessStaff_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
