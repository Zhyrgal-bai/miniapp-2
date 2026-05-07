-- Adds templateVersion to Business for template migrations/rollback.

ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "templateVersion" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS "Business_templateVersion_idx" ON "Business"("templateVersion");

