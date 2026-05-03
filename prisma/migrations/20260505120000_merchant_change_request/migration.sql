CREATE TABLE "MerchantChangeRequest" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BOT_TOKEN_CHANGE',
    "businessId" INTEGER NOT NULL,
    "newBotToken" TEXT NOT NULL,
    "requesterTelegramId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MerchantChangeRequest_status_idx" ON "MerchantChangeRequest"("status");

CREATE INDEX "MerchantChangeRequest_businessId_idx" ON "MerchantChangeRequest"("businessId");

ALTER TABLE "MerchantChangeRequest" ADD CONSTRAINT "MerchantChangeRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
