/** Refund amount and eligibility validation (shared, testable). */

export const REFUND_ACTIVE_STATUSES = [
  "REQUESTED",
  "REVIEWING",
  "APPROVED",
] as const;

export const REFUND_ELIGIBLE_ORDER_STATUSES = ["CONFIRMED", "SHIPPED"] as const;

export type RefundAmountValidation =
  | { ok: true; amount: number }
  | { ok: false; error: string };

export function validateRefundAmount(
  amount: unknown,
  orderTotal: number,
): RefundAmountValidation {
  if (orderTotal <= 0 || !Number.isFinite(orderTotal) || !Number.isInteger(orderTotal)) {
    return { ok: false, error: "Некорректная сумма заказа" };
  }
  if (amount === null || amount === undefined) {
    return { ok: false, error: "Укажите сумму возврата" };
  }
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { ok: false, error: "Сумма возврата должна быть целым числом" };
  }
  if (n <= 0) {
    return { ok: false, error: "Сумма возврата должна быть больше 0" };
  }
  if (n > orderTotal) {
    return { ok: false, error: "Сумма возврата не может превышать сумму заказа" };
  }
  return { ok: true, amount: n };
}

export function isRefundEligibleOrderStatus(status: string): boolean {
  const u = String(status ?? "").trim().toUpperCase();
  return (REFUND_ELIGIBLE_ORDER_STATUSES as readonly string[]).includes(u);
}

export function isRefundTerminalStatus(status: string): boolean {
  const u = String(status ?? "").trim().toUpperCase();
  return u === "REFUNDED" || u === "REJECTED";
}

export type RefundMethodWire = "MANUAL" | "FINIK" | "AUTO";

export function parseRefundMethod(raw: unknown): RefundMethodWire | null {
  if (typeof raw !== "string") return null;
  const u = raw.trim().toUpperCase();
  if (u === "MANUAL" || u === "FINIK" || u === "AUTO") return u;
  return null;
}

export function finikExternalId(businessId: number, orderId: number): string {
  return `${businessId}:${orderId}`;
}
