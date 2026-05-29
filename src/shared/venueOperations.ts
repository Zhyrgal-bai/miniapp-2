/**
 * Live venue / waiter operations (Phase 5–6D).
 */

export type TableLiveStatus =
  | "FREE"
  | "RESERVED"
  | "ARRIVED"
  | "ORDERING"
  | "EATING"
  | "PAYMENT"
  | "CLEANING";

export type TableSessionStatus = "ACTIVE" | "PAYMENT_REQUESTED" | "CLOSED";

export type OrderPrepStatus =
  | "NONE"
  | "SCHEDULED"
  | "READY_FOR_PREP"
  | "PREPARING"
  | "READY"
  | "SERVED";

export const TABLE_LIVE_STATUS_LABELS: Record<TableLiveStatus, string> = {
  FREE: "Свободен",
  RESERVED: "Бронь",
  ARRIVED: "Гости за столом",
  ORDERING: "Заказ",
  EATING: "Едят",
  PAYMENT: "Оплата",
  CLEANING: "Уборка",
};

export const ORDER_PREP_STATUS_LABELS: Record<OrderPrepStatus, string> = {
  NONE: "—",
  SCHEDULED: "Запланировано",
  READY_FOR_PREP: "Готовить",
  PREPARING: "Готовится",
  READY: "Готово",
  SERVED: "Выдано",
};

/** Dine-in / QR orders — unchanged from Phase 5. */
export const KITCHEN_ACTIVE_PREP_STATUSES: OrderPrepStatus[] = [
  "PREPARING",
  "READY",
  "SERVED",
];

/** Reservation preorder: scheduled queue. */
export const KITCHEN_SCHEDULED_PREP_STATUSES: OrderPrepStatus[] = ["SCHEDULED"];

/** Reservation preorder: cook-now queue. */
export const KITCHEN_PREORDER_ACTIVE_PREP_STATUSES: OrderPrepStatus[] = [
  "READY_FOR_PREP",
  "PREPARING",
  "READY",
  "SERVED",
];

export const VENUE_REALTIME_EVENT = {
  FLOOR: "floor",
  KITCHEN: "kitchen",
  SESSION: "session",
} as const;
