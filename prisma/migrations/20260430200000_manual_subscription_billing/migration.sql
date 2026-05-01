-- Manual subscription: block flag + payment receipt requests
ALTER TABLE "Business" ADD COLUMN "isBlocked" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Business_isBlocked_idx" ON "Business"("isBlocked");

CREATE TABLE "PaymentRequest" (
    "id" SERIAL NOT NULL,
    "businessId" INTEGER NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "amountSom" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentRequest_businessId_idx" ON "PaymentRequest"("businessId");

CREATE INDEX "PaymentRequest_status_idx" ON "PaymentRequest"("status");

ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
