import type { Prisma } from "@prisma/client";
import { inventoryVariantKey } from "../shared/inventory.js";
import { formatOrderLineSummary } from "../shared/businessCommerce.js";
import { logCheckoutReject, logInventoryReserveFailed } from "./structuredLog.js";

type Tx = Prisma.TransactionClient;

export type CheckoutLineInput = {
  productId: number;
  size: string;
  color: string;
  quantity: number;
  options?: Record<string, unknown>;
};

export type PricedCheckoutLine = CheckoutLineInput & {
  name: string;
  unitPrice: number;
  lineTotal: number;
  available: number;
};

function effectiveUnitPrice(product: {
  price: number;
  discountPercent: number | null;
}): number {
  const base = Number(product.price);
  if (!Number.isFinite(base) || base < 0) return 0;
  const d = product.discountPercent;
  if (d == null || !Number.isFinite(Number(d)) || Number(d) <= 0) {
    return Math.round(base);
  }
  const pct = Math.min(100, Math.max(0, Math.round(Number(d))));
  return Math.max(0, Math.round((base * (100 - pct)) / 100));
}

export async function priceCheckoutLines(
  tx: Tx,
  businessId: number,
  businessType: string,
  lines: CheckoutLineInput[],
): Promise<
  | { ok: true; lines: PricedCheckoutLine[]; subtotal: number }
  | { ok: false; statusCode: number; error: string }
> {
  const priced: PricedCheckoutLine[] = [];

  for (const line of lines) {
    const productId = Math.round(Number(line.productId));
    const qty = Math.round(Number(line.quantity));
    if (
      !Number.isInteger(productId) ||
      productId <= 0 ||
      !Number.isInteger(qty) ||
      qty < 1
    ) {
      return { ok: false, statusCode: 400, error: "Неверная позиция в корзине" };
    }

    const product = await tx.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        businessId: true,
        name: true,
        price: true,
        discountPercent: true,
      },
    });
    if (!product || product.businessId !== businessId) {
      logCheckoutReject({
        businessId,
        reason: "cross_shop_or_missing_product",
      });
      return { ok: false, statusCode: 400, error: "Товар не найден в этом магазине" };
    }

    const size = String(line.size ?? "").trim();
    const color = String(line.color ?? "").trim();
    const variantKey = inventoryVariantKey(size, color);

    const stockRow = await tx.productStock.findUnique({
      where: {
        businessId_productId_variantKey: {
          businessId,
          productId,
          variantKey,
        },
      },
      select: { available: true },
    });

    const available = Math.max(0, Number(stockRow?.available ?? 0));
    if (available < qty) {
      logInventoryReserveFailed({
        businessId,
        productId,
        size,
        color,
        error: `requested ${qty}, available ${available}`,
      });
      return {
        ok: false,
        statusCode: 409,
        error: `Недостаточно на складе: ${product.name} (${formatOrderLineSummary({
          businessType,
          size,
          color,
          options:
            line.options != null && typeof line.options === "object"
              ? (line.options as Record<string, unknown>)
              : null,
        })})`,
      };
    }

    const unitPrice = effectiveUnitPrice(product);
    priced.push({
      ...line,
      productId,
      quantity: qty,
      name: product.name.trim() || "Товар",
      unitPrice,
      lineTotal: unitPrice * qty,
      available,
    });
  }

  const subtotal = priced.reduce((acc, l) => acc + l.lineTotal, 0);
  return { ok: true, lines: priced, subtotal: Math.round(subtotal) };
}
