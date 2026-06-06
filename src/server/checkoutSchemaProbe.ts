import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

export type CheckoutSchemaProbeResult = {
  ok: boolean;
  missing: string[];
};

const TABLE_PROBES: Array<{ key: string; sql: Prisma.Sql }> = [
  { key: "ProductStock", sql: Prisma.sql`SELECT 1 FROM "ProductStock" LIMIT 0` },
  {
    key: "StockMovement",
    sql: Prisma.sql`SELECT 1 FROM "StockMovement" LIMIT 0`,
  },
  {
    key: "ActionCooldown",
    sql: Prisma.sql`SELECT 1 FROM "ActionCooldown" LIMIT 0`,
  },
  {
    key: "BusinessDailyOrderCounter",
    sql: Prisma.sql`SELECT 1 FROM "BusinessDailyOrderCounter" LIMIT 0`,
  },
];

const COLUMN_PROBES: Array<{ key: string; sql: Prisma.Sql }> = [
  {
    key: "OrderItem.options",
    sql: Prisma.sql`SELECT "options" FROM "OrderItem" LIMIT 0`,
  },
  {
    key: "Order.deliveryMode",
    sql: Prisma.sql`SELECT "deliveryMode" FROM "Order" LIMIT 0`,
  },
  {
    key: "Order.deliveryStage",
    sql: Prisma.sql`SELECT "deliveryStage" FROM "Order" LIMIT 0`,
  },
  {
    key: "Order.estimatedDeliveryAt",
    sql: Prisma.sql`SELECT "estimatedDeliveryAt" FROM "Order" LIMIT 0`,
  },
  {
    key: "Order.preparationMinutes",
    sql: Prisma.sql`SELECT "preparationMinutes" FROM "Order" LIMIT 0`,
  },
  {
    key: "Order.orderNumber",
    sql: Prisma.sql`SELECT "orderNumber" FROM "Order" LIMIT 0`,
  },
  {
    key: "Order.reservationId",
    sql: Prisma.sql`SELECT "reservationId" FROM "Order" LIMIT 0`,
  },
  {
    key: "Order.preorderStatus",
    sql: Prisma.sql`SELECT "preorderStatus" FROM "Order" LIMIT 0`,
  },
  {
    key: "Order.kitchenPrepAt",
    sql: Prisma.sql`SELECT "kitchenPrepAt" FROM "Order" LIMIT 0`,
  },
  {
    key: "Product.preparationMinutes",
    sql: Prisma.sql`SELECT "preparationMinutes" FROM "Product" LIMIT 0`,
  },
  {
    key: "Order.deliveryFee",
    sql: Prisma.sql`SELECT "deliveryFee" FROM "Order" LIMIT 0`,
  },
  {
    key: "Business.deliverySettings",
    sql: Prisma.sql`SELECT "deliverySettings" FROM "Business" LIMIT 0`,
  },
  {
    key: "Business.storeAvailabilitySettings",
    sql: Prisma.sql`SELECT "storeAvailabilitySettings" FROM "Business" LIMIT 0`,
  },
];

/** Verify checkout-critical tables/columns exist (production migration drift). */
export async function probeCheckoutSchema(
  db: PrismaClient,
): Promise<CheckoutSchemaProbeResult> {
  const missing: string[] = [];

  for (const probe of [...TABLE_PROBES, ...COLUMN_PROBES]) {
    try {
      await db.$queryRaw(probe.sql);
    } catch {
      missing.push(probe.key);
    }
  }

  return { ok: missing.length === 0, missing };
}

const CHECKOUT_SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000;
let checkoutSchemaCache: {
  result: CheckoutSchemaProbeResult;
  expiresAt: number;
} | null = null;

/** Cached probe for hot checkout path; full probe still used on /ready. */
export async function getCachedCheckoutSchemaProbe(
  db: PrismaClient,
): Promise<CheckoutSchemaProbeResult> {
  const now = Date.now();
  if (checkoutSchemaCache != null && checkoutSchemaCache.expiresAt > now) {
    return checkoutSchemaCache.result;
  }
  const result = await probeCheckoutSchema(db);
  checkoutSchemaCache = {
    result,
    expiresAt: now + CHECKOUT_SCHEMA_CACHE_TTL_MS,
  };
  return result;
}
