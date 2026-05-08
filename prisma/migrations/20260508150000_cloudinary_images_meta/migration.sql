-- Stage 6.5: store Cloudinary metadata for Product images (backwards compatible).
-- Prisma migrate may not be available locally in some environments; keep this SQL idempotent.

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "imagesMeta" JSONB NOT NULL DEFAULT '[]';

