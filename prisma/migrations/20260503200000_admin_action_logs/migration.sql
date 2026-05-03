-- CreateEnum
CREATE TYPE "AdminActionType" AS ENUM ('DELETE_SHOP', 'EXTEND_SUBSCRIPTION');

-- CreateTable
CREATE TABLE "AdminActionLog" (
    "id" SERIAL NOT NULL,
    "adminTelegramId" TEXT NOT NULL,
    "action" "AdminActionType" NOT NULL,
    "targetBusinessId" INTEGER NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminActionLog_adminTelegramId_idx" ON "AdminActionLog"("adminTelegramId");

-- CreateIndex
CREATE INDEX "AdminActionLog_targetBusinessId_idx" ON "AdminActionLog"("targetBusinessId");

-- CreateIndex
CREATE INDEX "AdminActionLog_createdAt_idx" ON "AdminActionLog"("createdAt");
