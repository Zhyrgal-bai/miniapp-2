-- SaaS RBAC: global User + per-Business Membership (OWNER | ADMIN | CLIENT).

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'CLIENT');

-- CreateTable
CREATE TABLE "Membership" (
    "id" SERIAL NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'CLIENT',
    "userId" INTEGER NOT NULL,
    "businessId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_businessId_key" ON "Membership"("userId", "businessId");
CREATE INDEX "Membership_businessId_idx" ON "Membership"("businessId");

-- AddForeignKey (before data backfill FK is satisfied by existing User rows)
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill membership from legacy per-tenant User rows
INSERT INTO "Membership" ("role", "userId", "businessId", "updatedAt")
SELECT
    CASE
        WHEN u."role" = 'OWNER'::"UserRole" THEN 'OWNER'::"MembershipRole"
        WHEN u."role" = 'ADMIN'::"UserRole" THEN 'ADMIN'::"MembershipRole"
        ELSE 'CLIENT'::"MembershipRole"
    END,
    u."id",
    u."businessId",
    u."updatedAt"
FROM "User" u;

-- Merge duplicate telegram accounts into canonical row (MIN id per telegramId)
WITH canon AS (
    SELECT "telegramId", MIN(id) AS keep_id FROM "User" GROUP BY "telegramId"
),
drop_pairs AS (
    SELECT u.id AS old_id, c.keep_id
    FROM "User" u
    INNER JOIN canon c ON u."telegramId" = c."telegramId"
    WHERE u.id <> c.keep_id
)
UPDATE "Order" o
SET "buyerUserId" = dp.keep_id
FROM drop_pairs dp
WHERE o."buyerUserId" = dp.old_id;

WITH canon AS (
    SELECT "telegramId", MIN(id) AS keep_id FROM "User" GROUP BY "telegramId"
),
drop_pairs AS (
    SELECT u.id AS old_id, c.keep_id
    FROM "User" u
    INNER JOIN canon c ON u."telegramId" = c."telegramId"
    WHERE u.id <> c.keep_id
)
UPDATE "Membership" m
SET "userId" = dp.keep_id
FROM drop_pairs dp
WHERE m."userId" = dp.old_id;

WITH canon AS (
    SELECT "telegramId", MIN(id) AS keep_id FROM "User" GROUP BY "telegramId"
),
drop_pairs AS (
    SELECT u.id AS old_id
    FROM "User" u
    INNER JOIN canon c ON u."telegramId" = c."telegramId"
    WHERE u.id <> c.keep_id
)
DELETE FROM "User" u USING drop_pairs dp WHERE u.id = dp.old_id;

-- Normalize User identity (drop per-tenant columns)
DROP INDEX IF EXISTS "User_businessId_telegramId_key";
DROP INDEX IF EXISTS "User_businessId_idx";

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_businessId_fkey";

ALTER TABLE "User" DROP COLUMN "businessId",
DROP COLUMN "role";

DROP TYPE "UserRole";

CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- Keep Membership serial in sync after explicit inserts
SELECT setval(
    pg_get_serial_sequence('"Membership"', 'id'),
    COALESCE((SELECT MAX("id") FROM "Membership"), 1),
    true
);
