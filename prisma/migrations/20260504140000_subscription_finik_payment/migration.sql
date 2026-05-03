CREATE TABLE "SubscriptionFinikPayment" (
    "id" SERIAL NOT NULL,
    "businessId" INTEGER NOT NULL,
    "finikPaymentId" TEXT,
    "planDays" INTEGER NOT NULL,
    "amountSom" INTEGER NOT NULL,
    "payerTelegramId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionFinikPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionFinikPayment_finikPaymentId_key" ON "SubscriptionFinikPayment"("finikPaymentId");

CREATE INDEX "SubscriptionFinikPayment_businessId_idx" ON "SubscriptionFinikPayment"("businessId");

CREATE INDEX "SubscriptionFinikPayment_status_idx" ON "SubscriptionFinikPayment"("status");

ALTER TABLE "SubscriptionFinikPayment" ADD CONSTRAINT "SubscriptionFinikPayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
