-- Media lifecycle: audit log, destroy retry queue, QR publicId

CREATE TYPE "MediaAuditEvent" AS ENUM (
  'UPLOAD',
  'REPLACE',
  'DELETE',
  'ARCHIVE',
  'RESTORE',
  'PURGE',
  'CLEANUP',
  'RETRY'
);

CREATE TYPE "MediaDestroyJobStatus" AS ENUM (
  'PENDING',
  'DONE',
  'FAILED'
);

ALTER TABLE "Settings"
  ADD COLUMN IF NOT EXISTS "qrPublicId" TEXT;

CREATE TABLE IF NOT EXISTS "MediaAuditLog" (
  "id" SERIAL NOT NULL,
  "businessId" INTEGER NOT NULL,
  "event" "MediaAuditEvent" NOT NULL,
  "publicId" TEXT,
  "productId" INTEGER,
  "actorType" TEXT NOT NULL,
  "actorUserId" INTEGER,
  "details" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MediaDestroyJob" (
  "id" SERIAL NOT NULL,
  "businessId" INTEGER NOT NULL,
  "publicId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "MediaDestroyJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextRetryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaDestroyJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MediaAuditLog_businessId_createdAt_idx"
  ON "MediaAuditLog"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "MediaAuditLog_publicId_idx"
  ON "MediaAuditLog"("publicId");
CREATE INDEX IF NOT EXISTS "MediaDestroyJob_status_nextRetryAt_idx"
  ON "MediaDestroyJob"("status", "nextRetryAt");
CREATE INDEX IF NOT EXISTS "MediaDestroyJob_businessId_idx"
  ON "MediaDestroyJob"("businessId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MediaAuditLog_businessId_fkey'
  ) THEN
    ALTER TABLE "MediaAuditLog"
      ADD CONSTRAINT "MediaAuditLog_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MediaDestroyJob_businessId_fkey'
  ) THEN
    ALTER TABLE "MediaDestroyJob"
      ADD CONSTRAINT "MediaDestroyJob_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
