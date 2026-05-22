import { DeliveryMode, OrderStatus, Prisma } from "@prisma/client";

/** Safe positive integer for Prisma Int fields (quantity, productId, etc.). */
export function coercePositiveInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (!Number.isInteger(r) || r <= 0) return null;
  return r;
}

/** Safe non-negative integer for totals and prices. */
export function coerceNonNegativeInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (!Number.isInteger(r) || r < 0) return null;
  return r;
}

/** Plain JSON object safe for OrderItem.options (no undefined / non-JSON values). */
export function orderOptionsToJson(
  options: Record<string, unknown>,
): Prisma.InputJsonValue {
  const plain: Record<string, Prisma.JsonValue> = {};
  for (const [k, v] of Object.entries(options)) {
    if (v === undefined) continue;
    if (
      v === null ||
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean"
    ) {
      plain[k] = v;
      continue;
    }
    if (Array.isArray(v)) {
      plain[k] = v.map((x) =>
        typeof x === "string" ||
        typeof x === "number" ||
        typeof x === "boolean"
          ? x
          : String(x),
      );
      continue;
    }
    plain[k] = String(v);
  }
  return plain;
}

/** Accept deliveryMode (enum) or deliveryType (storefront: delivery / pickup). */
export function parseCheckoutDeliveryMode(body: {
  deliveryMode?: unknown;
  deliveryType?: unknown;
}): DeliveryMode {
  const raw = String(body.deliveryMode ?? body.deliveryType ?? "")
    .trim()
    .toUpperCase();
  if (raw === "PICKUP" || raw === "САМОВЫВОЗ") return DeliveryMode.PICKUP;
  return DeliveryMode.DELIVERY;
}

export type CheckoutOrderItemRow = {
  businessId: number;
  productId: number;
  name: string;
  size: string;
  color: string;
  options: Prisma.InputJsonValue;
  quantity: number;
  price: number;
};

export function buildCheckoutOrderItemRows(
  businessId: number,
  pricedLines: Array<{
    productId: number;
    name: string;
    size: string;
    color: string;
    quantity: number;
    unitPrice: number;
  }>,
  optionsPerLine: Record<string, unknown>[],
): CheckoutOrderItemRow[] {
  return pricedLines.map((line, idx) => {
    const rawOpts = optionsPerLine[idx];
    const opts =
      rawOpts != null &&
      typeof rawOpts === "object" &&
      !Array.isArray(rawOpts)
        ? (rawOpts as Record<string, unknown>)
        : {};

    const productId = coercePositiveInt(line.productId);
    const quantity = coercePositiveInt(line.quantity);
    const price = coerceNonNegativeInt(line.unitPrice);
    if (productId == null || quantity == null || price == null) {
      throw new Error("INVALID_ITEM");
    }

    return {
      businessId,
      productId,
      name: String(line.name ?? "Товар").trim().slice(0, 500) || "Товар",
      size: String(line.size ?? "").trim().slice(0, 200),
      color: String(line.color ?? "").trim().slice(0, 200),
      options: orderOptionsToJson(opts),
      quantity,
      price,
    };
  });
}

export function coerceCheckoutOrderTotal(value: unknown): number {
  const n = coerceNonNegativeInt(value);
  if (n == null) throw new Error("INVALID_ITEM");
  return n;
}
