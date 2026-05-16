-- Secure operator mode: unlock sessions storage

CREATE TABLE IF NOT EXISTS "PlatformOperatorSession" (
  "id" SERIAL NOT NULL,
  "operatorTelegramId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userAgent" TEXT,
  "ipHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastReauthAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "PlatformOperatorSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformOperatorSession_tokenHash_key"
ON "PlatformOperatorSession"("tokenHash");

CREATE INDEX IF NOT EXISTS "PlatformOperatorSession_operatorTelegramId_idx"
ON "PlatformOperatorSession"("operatorTelegramId");

CREATE INDEX IF NOT EXISTS "PlatformOperatorSession_expiresAt_idx"
ON "PlatformOperatorSession"("expiresAt");

CREATE INDEX IF NOT EXISTS "PlatformOperatorSession_revokedAt_idx"
ON "PlatformOperatorSession"("revokedAt");
