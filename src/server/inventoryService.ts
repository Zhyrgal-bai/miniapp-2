import type { Prisma } from "@prisma/client";
import { StockMovementKind } from "@prisma/client";
import {
  flattenVariantStockRows,
  inventoryVariantKey,
  isLowStock,
  parseProductVariants,
  type ProductVariantInput,
} from "../shared/inventory.js";
import { prisma } from "./db.js";
import { createMerchantNotification } from "./merchantNotificationsService.js";

type Tx = Prisma.TransactionClient;

export type OrderLineForStock = {
  id?: number;
  productId: number | null;
  size: string;
  color: string;
  quantity: number;
};

async function ensureStockRow(
  tx: Tx,
  businessId: number,
  productId: number,
  size: string,
  color: string
) {
  const variantKey = inventoryVariantKey(size, color);
  let row = await tx.productStock.findUnique({
    where: {
      businessId_productId_variantKey: { businessId, productId, variantKey },
    },
  });
  if (!row) {
    row = await tx.productStock.create({
      data: {
        businessId,
        productId,
        size: String(size ?? "").trim(),
        color: String(color ?? "").trim(),
        variantKey,
        available: 0,
      },
    });
  }
  return row;
}

async function logMovement(
  tx: Tx,
  input: {
    businessId: number;
    productStockId: number;
    kind: StockMovementKind;
    quantity: number;
    orderId?: number | null;
    orderItemId?: number | null;
    meta?: Record<string, unknown>;
  }
): Promise<void> {
  await tx.stockMovement.create({
    data: {
      businessId: input.businessId,
      productStockId: input.productStockId,
      orderId: input.orderId ?? null,
      orderItemId: input.orderItemId ?? null,
      kind: input.kind,
      quantity: input.quantity,
      meta: (input.meta ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function syncProductStockFromVariants(input: {
  businessId: number;
  productId: number;
  variants: ProductVariantInput[];
}): Promise<void> {
  const rows = flattenVariantStockRows(input.variants);
  const activeKeys = new Set(
    rows.map((r) => inventoryVariantKey(r.size, r.color))
  );
  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      const variantKey = inventoryVariantKey(r.size, r.color);
      const existing = await tx.productStock.findUnique({
        where: {
          businessId_productId_variantKey: {
            businessId: input.businessId,
            productId: input.productId,
            variantKey,
          },
        },
      });
      const locked =
        (existing?.reserved ?? 0) +
        (existing?.paid ?? 0) +
        (existing?.shipped ?? 0) +
        (existing?.returned ?? 0);
      const available = Math.max(0, r.stock - locked);
      if (existing) {
        await tx.productStock.update({
          where: { id: existing.id },
          data: { size: r.size, color: r.color, available },
        });
      } else {
        await tx.productStock.create({
          data: {
            businessId: input.businessId,
            productId: input.productId,
            size: r.size,
            color: r.color,
            variantKey,
            available: r.stock,
          },
        });
      }
    }

    const orphans = await tx.productStock.findMany({
      where: { businessId: input.businessId, productId: input.productId },
    });
    for (const row of orphans) {
      if (activeKeys.has(row.variantKey)) continue;
      const locked = row.reserved + row.paid + row.shipped + row.returned;
      if (locked > 0) {
        await tx.productStock.update({
          where: { id: row.id },
          data: { available: 0 },
        });
        continue;
      }
      await tx.productStock.delete({ where: { id: row.id } });
    }
  });
}

export async function reserveOrderStock(
  tx: Tx,
  businessId: number,
  orderId: number,
  lines: OrderLineForStock[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const line of lines) {
    if (line.productId == null || line.quantity < 1) continue;
    const qty = Math.round(line.quantity);
    const row = await ensureStockRow(
      tx,
      businessId,
      line.productId,
      line.size,
      line.color
    );
    const updated = await tx.productStock.updateMany({
      where: { id: row.id, available: { gte: qty } },
      data: {
        available: { decrement: qty },
        reserved: { increment: qty },
      },
    });
    if (updated.count !== 1) {
      const { logInventoryReserveFailed } = await import("./structuredLog.js");
      logInventoryReserveFailed({
        businessId,
        orderId,
        productId: line.productId ?? undefined,
        size: line.size,
        color: line.color,
        error: `available insufficient for qty ${qty}`,
      });
      return {
        ok: false,
        error: `Недостаточно на складе: ${line.size} / ${line.color}`,
      };
    }
    await logMovement(tx, {
      businessId,
      productStockId: row.id,
      kind: StockMovementKind.RESERVE,
      quantity: qty,
      orderId,
      orderItemId: line.id ?? null,
    });
  }
  return { ok: true };
}

export async function releaseOrderStock(
  tx: Tx,
  businessId: number,
  orderId: number,
  lines: OrderLineForStock[]
): Promise<void> {
  for (const line of lines) {
    if (line.productId == null || line.quantity < 1) continue;
    const qty = Math.round(line.quantity);
    const variantKey = inventoryVariantKey(line.size, line.color);
    const row = await tx.productStock.findUnique({
      where: {
        businessId_productId_variantKey: {
          businessId,
          productId: line.productId,
          variantKey,
        },
      },
    });
    if (!row) continue;
    const fromReserved = Math.min(row.reserved, qty);
    if (fromReserved > 0) {
      await tx.productStock.update({
        where: { id: row.id },
        data: {
          reserved: { decrement: fromReserved },
          available: { increment: fromReserved },
        },
      });
      await logMovement(tx, {
        businessId,
        productStockId: row.id,
        kind: StockMovementKind.RELEASE,
        quantity: fromReserved,
        orderId,
        orderItemId: line.id ?? null,
      });
    }
  }
}

export async function commitPaidOrderStock(
  tx: Tx,
  businessId: number,
  orderId: number,
  lines: OrderLineForStock[]
): Promise<void> {
  for (const line of lines) {
    if (line.productId == null || line.quantity < 1) continue;
    const qty = Math.round(line.quantity);
    const variantKey = inventoryVariantKey(line.size, line.color);
    const row = await tx.productStock.findUnique({
      where: {
        businessId_productId_variantKey: {
          businessId,
          productId: line.productId,
          variantKey,
        },
      },
    });
    if (!row) continue;
    const move = Math.min(row.reserved, qty);
    if (move <= 0) continue;
    await tx.productStock.update({
      where: { id: row.id },
      data: {
        reserved: { decrement: move },
        paid: { increment: move },
      },
    });
    await logMovement(tx, {
      businessId,
      productStockId: row.id,
      kind: StockMovementKind.COMMIT_PAID,
      quantity: move,
      orderId,
      orderItemId: line.id ?? null,
    });
  }
}

export async function restorePaidOrderStock(
  tx: Tx,
  businessId: number,
  orderId: number,
  lines: OrderLineForStock[]
): Promise<void> {
  for (const line of lines) {
    if (line.productId == null || line.quantity < 1) continue;
    const qty = Math.round(line.quantity);
    const variantKey = inventoryVariantKey(line.size, line.color);
    const row = await tx.productStock.findUnique({
      where: {
        businessId_productId_variantKey: {
          businessId,
          productId: line.productId,
          variantKey,
        },
      },
    });
    if (!row) continue;
    const fromPaid = Math.min(row.paid, qty);
    if (fromPaid > 0) {
      await tx.productStock.update({
        where: { id: row.id },
        data: {
          paid: { decrement: fromPaid },
          available: { increment: fromPaid },
        },
      });
      await logMovement(tx, {
        businessId,
        productStockId: row.id,
        kind: StockMovementKind.RESTORE_PAID,
        quantity: fromPaid,
        orderId,
        orderItemId: line.id ?? null,
      });
    }
  }
}

export async function shipOrderStock(
  tx: Tx,
  businessId: number,
  orderId: number,
  lines: OrderLineForStock[]
): Promise<void> {
  for (const line of lines) {
    if (line.productId == null || line.quantity < 1) continue;
    const qty = Math.round(line.quantity);
    const variantKey = inventoryVariantKey(line.size, line.color);
    const row = await tx.productStock.findUnique({
      where: {
        businessId_productId_variantKey: {
          businessId,
          productId: line.productId,
          variantKey,
        },
      },
    });
    if (!row) continue;
    const move = Math.min(row.paid, qty);
    if (move <= 0) continue;
    await tx.productStock.update({
      where: { id: row.id },
      data: {
        paid: { decrement: move },
        shipped: { increment: move },
      },
    });
    await logMovement(tx, {
      businessId,
      productStockId: row.id,
      kind: StockMovementKind.SHIP,
      quantity: move,
      orderId,
      orderItemId: line.id ?? null,
    });
  }
}

export async function receiveReturnStock(
  tx: Tx,
  businessId: number,
  orderId: number,
  line: OrderLineForStock
): Promise<void> {
  if (line.productId == null || line.quantity < 1) return;
  const qty = Math.round(line.quantity);
  const variantKey = inventoryVariantKey(line.size, line.color);
  const row = await tx.productStock.findUnique({
    where: {
      businessId_productId_variantKey: {
        businessId,
        productId: line.productId,
        variantKey,
      },
    },
  });
  if (!row) return;
  const fromShipped = Math.min(row.shipped, qty);
  if (fromShipped <= 0) return;
  await tx.productStock.update({
    where: { id: row.id },
    data: {
      shipped: { decrement: fromShipped },
      returned: { increment: fromShipped },
    },
  });
  await logMovement(tx, {
    businessId,
    productStockId: row.id,
    kind: StockMovementKind.RETURN_RECEIVED,
    quantity: fromShipped,
    orderId,
    orderItemId: line.id ?? null,
  });
}

export async function restockReturned(
  tx: Tx,
  businessId: number,
  orderId: number,
  line: OrderLineForStock
): Promise<void> {
  if (line.productId == null || line.quantity < 1) return;
  const qty = Math.round(line.quantity);
  const variantKey = inventoryVariantKey(line.size, line.color);
  const row = await tx.productStock.findUnique({
    where: {
      businessId_productId_variantKey: {
        businessId,
        productId: line.productId,
        variantKey,
      },
    },
  });
  if (!row) return;
  const move = Math.min(row.returned, qty);
  if (move <= 0) return;
  await tx.productStock.update({
    where: { id: row.id },
    data: {
      returned: { decrement: move },
      available: { increment: move },
    },
  });
  await logMovement(tx, {
    businessId,
    productStockId: row.id,
    kind: StockMovementKind.RESTOCK,
    quantity: move,
    orderId,
    orderItemId: line.id ?? null,
  });
}

export async function restoreShippedOrderStock(
  tx: Tx,
  businessId: number,
  orderId: number,
  lines: OrderLineForStock[]
): Promise<void> {
  for (const line of lines) {
    if (line.productId == null || line.quantity < 1) continue;
    const qty = Math.round(line.quantity);
    const variantKey = inventoryVariantKey(line.size, line.color);
    const row = await tx.productStock.findUnique({
      where: {
        businessId_productId_variantKey: {
          businessId,
          productId: line.productId,
          variantKey,
        },
      },
    });
    if (!row) continue;
    const fromShipped = Math.min(row.shipped, qty);
    if (fromShipped > 0) {
      await tx.productStock.update({
        where: { id: row.id },
        data: {
          shipped: { decrement: fromShipped },
          available: { increment: fromShipped },
        },
      });
      await logMovement(tx, {
        businessId,
        productStockId: row.id,
        kind: StockMovementKind.RESTORE_PAID,
        quantity: fromShipped,
        orderId,
        orderItemId: line.id ?? null,
        meta: { bucket: "shipped" },
      });
    }
  }
}

export async function loadOrderLinesForStock(orderId: number): Promise<OrderLineForStock[]> {
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    select: { id: true, productId: true, size: true, color: true, quantity: true },
  });
  return items.map((i) => ({
    id: i.id,
    productId: i.productId,
    size: i.size,
    color: i.color,
    quantity: i.quantity,
  }));
}

export async function maybeNotifyLowStock(businessId: number, productId: number): Promise<void> {
  const rows = await prisma.productStock.findMany({
    where: { businessId, productId },
    select: { available: true, size: true, color: true },
  });
  for (const r of rows) {
    if (!isLowStock(r.available)) continue;
    void createMerchantNotification({
      businessId,
      kind: "LOW_STOCK",
      title: "Мало на складе",
      body: `${r.size} / ${r.color}: осталось ${r.available}`,
      href: "#/admin/products",
    });
  }
}

export async function loadStockRowsByProductIds(
  businessId: number,
  productIds: number[],
): Promise<Map<number, Array<{ size: string; color: string; available: number }>>> {
  const map = new Map<number, Array<{ size: string; color: string; available: number }>>();
  if (productIds.length === 0) return map;
  const rows = await prisma.productStock.findMany({
    where: { businessId, productId: { in: productIds } },
    select: { productId: true, size: true, color: true, available: true },
  });
  for (const r of rows) {
    const list = map.get(r.productId) ?? [];
    list.push({
      size: r.size,
      color: r.color,
      available: r.available,
    });
    map.set(r.productId, list);
  }
  return map;
}

export function extractVariantsFromProductPayload(
  attributes: unknown,
  variantsBody?: unknown
): ProductVariantInput[] {
  if (variantsBody != null) return parseProductVariants(variantsBody);
  if (attributes != null && typeof attributes === "object" && !Array.isArray(attributes)) {
    const v = (attributes as Record<string, unknown>).variants;
    return parseProductVariants(v);
  }
  return [];
}
