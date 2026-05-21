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
