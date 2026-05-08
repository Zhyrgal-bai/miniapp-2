-- One-off backfill (BROAD MODE):
-- Enable storefront for all businesses that are NOT manually blocked.
--
-- Rationale:
-- Storefront availability should not depend on legacy approve/trial coupling.
-- Manual block (isBlocked=true) remains the hard-disable mechanism.

UPDATE "Business"
SET "isActive" = true
WHERE COALESCE("isBlocked", false) = false;

