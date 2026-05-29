/** Reservation preorder payment lifecycle (Phase 6C). */
export type ReservationPreorderStatus =
  | "PREORDER_DRAFT"
  | "PREORDER_PAYMENT_PENDING"
  | "PREORDER_PAID"
  | "PREORDER_CANCELLED";

export const UNPAID_PREORDER_STATUSES: ReservationPreorderStatus[] = [
  "PREORDER_DRAFT",
  "PREORDER_PAYMENT_PENDING",
];

export const ACTIVE_PREORDER_STATUSES: ReservationPreorderStatus[] = [
  "PREORDER_DRAFT",
  "PREORDER_PAYMENT_PENDING",
  "PREORDER_PAID",
];

export const PREORDER_STATUS_LABELS: Record<ReservationPreorderStatus, string> = {
  PREORDER_DRAFT: "Черновик",
  PREORDER_PAYMENT_PENDING: "Ожидает оплату",
  PREORDER_PAID: "Оплачен",
  PREORDER_CANCELLED: "Отменён",
};

/** Guest/admin summary derived from linked orders. */
export type ReservationPreorderGuestStatus = "none" | "pending" | "paid";

export function preorderGuestStatusFromOrders(
  statuses: ReservationPreorderStatus[],
): ReservationPreorderGuestStatus {
  if (statuses.includes("PREORDER_PAID")) return "paid";
  if (statuses.some((s) => UNPAID_PREORDER_STATUSES.includes(s))) return "pending";
  return "none";
}

export function preorderGuestLabel(status: ReservationPreorderGuestStatus): string {
  if (status === "paid") return "Оплачен";
  if (status === "pending") return "Ожидает оплату";
  return "Нет предзаказа";
}
