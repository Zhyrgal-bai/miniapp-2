export type OrderStatus =
  | "NEW"
  | "ACCEPTED"
  | "PAID_PENDING"
  | "CONFIRMED"
  | "SHIPPED"
  | "CANCELLED";

const VALID_STATUSES: OrderStatus[] = [
  "NEW",
  "ACCEPTED",
  "PAID_PENDING",
  "CONFIRMED",
  "SHIPPED",
  "CANCELLED",
];

export function isValidOrderStatus(s: string): s is OrderStatus {
  return VALID_STATUSES.includes(s as OrderStatus);
}

/** Контекст для исключений (например Finik: ACCEPTED → CONFIRMED без чека). */
export type OrderStatusTransitionContext = {
  paymentMethod?: string | null;
};

/** Допустимые переходы для смены статуса через HTTP (не для прямых обновлений бота). */
const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["ACCEPTED"],
  ACCEPTED: ["PAID_PENDING"],
  PAID_PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED"],
  SHIPPED: [],
  CANCELLED: [],
};

export function isAllowedOrderStatusTransition(
  from: OrderStatus,
  to: OrderStatus,
  ctx?: OrderStatusTransitionContext
): boolean {
  if (from === to) return true;
  const pm = String(ctx?.paymentMethod ?? "").toLowerCase();
  if (from === "ACCEPTED" && to === "CONFIRMED" && pm === "finik") {
    return true;
  }
  const next = STATUS_TRANSITIONS[from];
  return next != null && next.includes(to);
}
