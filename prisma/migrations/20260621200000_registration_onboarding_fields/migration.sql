-- Registration onboarding: operator inbox fields + rejection reason
ALTER TABLE "RegistrationRequest" ADD COLUMN IF NOT EXISTS "ownerUsername" TEXT;
ALTER TABLE "RegistrationRequest" ADD COLUMN IF NOT EXISTS "botUsername" TEXT;
ALTER TABLE "RegistrationRequest" ADD COLUMN IF NOT EXISTS "rejectReason" TEXT;
