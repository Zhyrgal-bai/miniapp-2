-- Уникальность по SHA-256 токена; botToken хранит ciphertext (или legacy plain до шифрования на старте приложения).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE "Business" ADD COLUMN "botTokenHash" TEXT;

UPDATE "Business"
SET "botTokenHash" = encode(
  digest(convert_to(trim(both from "botToken"), 'UTF8'), 'sha256'),
  'hex'
)
WHERE "botTokenHash" IS NULL
  AND "botToken" IS NOT NULL
  AND trim(both from "botToken") <> ''
  AND "botToken" NOT LIKE 'enc:v1:%';

ALTER TABLE "Business" DROP CONSTRAINT IF EXISTS "Business_botToken_key";

CREATE UNIQUE INDEX "Business_botTokenHash_key" ON "Business"("botTokenHash");
