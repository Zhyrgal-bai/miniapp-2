-- Phase 14 lifetime analytics backfill (idempotent)

WITH agg AS (
  SELECT
    o."businessId",
    COUNT(*)::int AS created_orders,
    COUNT(*) FILTER (WHERE o.status IN ('CONFIRMED', 'SHIPPED', 'DELIVERED'))::int AS successful_orders,
    COALESCE(SUM(o.total) FILTER (WHERE o.status IN ('CONFIRMED', 'SHIPPED', 'DELIVERED')), 0)::int AS successful_revenue,
    COUNT(*) FILTER (WHERE o.status = 'DELIVERED')::int AS completed_orders,
    COUNT(*) FILTER (WHERE o.status = 'CANCELLED')::int AS cancelled_orders
  FROM "Order" o
  GROUP BY o."businessId"
)
INSERT INTO "MerchantLifetimeAnalytics" (
  "businessId",
  "createdOrders",
  "successfulOrders",
  "successfulRevenue",
  "completedOrders",
  "cancelledOrders"
)
SELECT
  a."businessId",
  a.created_orders,
  a.successful_orders,
  a.successful_revenue,
  a.completed_orders,
  a.cancelled_orders
FROM agg a
ON CONFLICT ("businessId") DO UPDATE SET
  "createdOrders" = GREATEST("MerchantLifetimeAnalytics"."createdOrders", EXCLUDED."createdOrders"),
  "successfulOrders" = GREATEST("MerchantLifetimeAnalytics"."successfulOrders", EXCLUDED."successfulOrders"),
  "successfulRevenue" = GREATEST("MerchantLifetimeAnalytics"."successfulRevenue", EXCLUDED."successfulRevenue"),
  "completedOrders" = GREATEST("MerchantLifetimeAnalytics"."completedOrders", EXCLUDED."completedOrders"),
  "cancelledOrders" = GREATEST("MerchantLifetimeAnalytics"."cancelledOrders", EXCLUDED."cancelledOrders"),
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "MerchantLifetimeOrderState" (
  "orderId",
  "businessId",
  "status",
  "countedRevenue"
)
SELECT
  o.id,
  o."businessId",
  o.status,
  CASE
    WHEN o.status IN ('CONFIRMED', 'SHIPPED', 'DELIVERED') THEN o.total
    ELSE 0
  END AS counted_revenue
FROM "Order" o
ON CONFLICT ("orderId") DO UPDATE SET
  "status" = EXCLUDED."status",
  "countedRevenue" = EXCLUDED."countedRevenue",
  "updatedAt" = CURRENT_TIMESTAMP;
