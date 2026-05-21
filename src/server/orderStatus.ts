export type OrderStatus =
  | "NEW"
  | "ACCEPTED"
  | "PAID_PENDING"
  | "CONFIRMED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

const VALID_STATUSES: OrderStatus[] = [
  "NEW",
  "ACCEPTED",
  "PAID_PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

export function isValidOrderStatus(s: string): s is OrderStatus {
  return VALID_STATUSES.includes(s as OrderStatus);
}

/** Контекст для исключений при смене статуса через HTTP. */
export type OrderStatusTransitionContext = {
  paymentMethod?: string | null;
};

/** Допустимые переходы для смены статуса через HTTP (не для прямых обновлений бота). */
const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["ACCEPTED"],
  ACCEPTED: ["PAID_PENDING"],
  PAID_PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function isAllowedOrderStatusTransition(
  from: OrderStatus,
  to: OrderStatus,
  _ctx?: OrderStatusTransitionContext
): boolean {
  if (from === to) return true;
  const next = STATUS_TRANSITIONS[from];
  return next != null && next.includes(to);
}
