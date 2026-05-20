-- CreateTable
CREATE TABLE "PlatformFunnelEvent" (
    "id" SERIAL NOT NULL,
    "step" TEXT NOT NULL,
    "telegramId" TEXT,
    "businessId" INTEGER,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformFunnelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFeedback" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "telegramId" TEXT,
    "businessId" INTEGER,
    "page" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformFunnelEvent_step_createdAt_idx" ON "PlatformFunnelEvent"("step", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformFunnelEvent_telegramId_createdAt_idx" ON "PlatformFunnelEvent"("telegramId", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformFunnelEvent_businessId_createdAt_idx" ON "PlatformFunnelEvent"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductFeedback_status_createdAt_idx" ON "ProductFeedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductFeedback_businessId_createdAt_idx" ON "ProductFeedback"("businessId", "createdAt");
