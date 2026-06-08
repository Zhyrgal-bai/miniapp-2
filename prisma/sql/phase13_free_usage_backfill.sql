-- Phase 13 grandfather backfill (run once after migration deploy)
-- Active paid subscriptions: no change
-- TRIALING with future trialEndsAt: set freeOrdersUsed from confirmed orders
-- Expired trial / EXPIRED without paid: FREE or QUOTA_EXHAUSTED + isActive=true

WITH paid_counts AS (
  SELECT
    "businessId",
    COUNT(*)::int AS confirmed_count
  FROM "Order"
  WHERE status IN ('CONFIRMED', 'SHIPPED', 'DELIVERED')
  GROUP BY "businessId"
),
cohorts AS (
  SELECT
    b.id,
    b."subscriptionStatus",
    b."trialEndsAt",
    b."subscriptionEndsAt",
    COALESCE(pc.confirmed_count, 0) AS confirmed_count,
    LEAST(COALESCE(pc.confirmed_count, 0), COALESCE(b."freeOrdersLimit", 5)) AS used_cap
  FROM "Business" b
  LEFT JOIN paid_counts pc ON pc."businessId" = b.id
)
UPDATE "Business" b
SET
  "freeOrdersUsed" = c.used_cap,
  "subscriptionStatus" = CASE
    WHEN b."subscriptionStatus" = 'ACTIVE'
      AND b."subscriptionEndsAt" IS NOT NULL
      AND b."subscriptionEndsAt" > NOW()
      THEN b."subscriptionStatus"
    WHEN b."subscriptionStatus" = 'TRIALING'
      AND b."trialEndsAt" IS NOT NULL
      AND b."trialEndsAt" > NOW()
      THEN b."subscriptionStatus"
    WHEN c.used_cap >= COALESCE(b."freeOrdersLimit", 5)
      THEN 'QUOTA_EXHAUSTED'::"SubscriptionStatus"
    ELSE 'FREE'::"SubscriptionStatus"
  END,
  "isActive" = CASE
    WHEN b."isBlocked" = true THEN b."isActive"
    WHEN b."subscriptionStatus" = 'ACTIVE'
      AND b."subscriptionEndsAt" IS NOT NULL
      AND b."subscriptionEndsAt" > NOW()
      THEN b."isActive"
    WHEN b."subscriptionStatus" = 'TRIALING'
      AND b."trialEndsAt" IS NOT NULL
      AND b."trialEndsAt" > NOW()
      THEN b."isActive"
    WHEN c.used_cap >= COALESCE(b."freeOrdersLimit", 5)
      THEN true
    ELSE true
  END,
  "quotaExhaustedAt" = CASE
    WHEN c.used_cap >= COALESCE(b."freeOrdersLimit", 5)
      AND NOT (
        b."subscriptionStatus" = 'ACTIVE'
        AND b."subscriptionEndsAt" IS NOT NULL
        AND b."subscriptionEndsAt" > NOW()
      )
      THEN COALESCE(b."quotaExhaustedAt", NOW())
    ELSE b."quotaExhaustedAt"
  END
FROM cohorts c
WHERE c.id = b.id;
