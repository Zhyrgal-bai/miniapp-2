-- Human-friendly daily order numbers per business (e.g. 2105-001).
ALTER TABLE "Order" ADD COLUMN "orderNumber" TEXT;

CREATE TABLE "BusinessDailyOrderCounter" (
    "businessId" INTEGER NOT NULL,
    "dayKey" TEXT NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BusinessDailyOrderCounter_pkey" PRIMARY KEY ("businessId","dayKey")
);

CREATE INDEX "BusinessDailyOrderCounter_businessId_idx" ON "BusinessDailyOrderCounter"("businessId");

CREATE INDEX "Order_businessId_orderNumber_idx" ON "Order"("businessId", "orderNumber");

ALTER TABLE "BusinessDailyOrderCounter" ADD CONSTRAINT "BusinessDailyOrderCounter_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
