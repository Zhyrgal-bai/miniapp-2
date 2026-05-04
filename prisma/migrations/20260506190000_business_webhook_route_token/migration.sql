-- Секретный сегмент пути для клиентских ботов (Telegram webhook).
ALTER TABLE "Business" ADD COLUMN "webhookRouteToken" TEXT;

CREATE UNIQUE INDEX "Business_webhookRouteToken_key" ON "Business"("webhookRouteToken");

UPDATE "Business"
SET "webhookRouteToken" = REPLACE(gen_random_uuid()::TEXT, '-', '')
WHERE "webhookRouteToken" IS NULL OR TRIM(BOTH FROM "webhookRouteToken") = '';
