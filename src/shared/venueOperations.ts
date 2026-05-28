/**
 * Live venue / waiter operations (Phase 5).
 * Future: depositPaymentId, splitBill guests[], liveOccupancy on Business.
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

export type OrderPrepStatus = "NONE" | "PREPARING" | "READY" | "SERVED";

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
  PREPARING: "Готовится",
  READY: "Готово",
  SERVED: "Выдано",
};

export const VENUE_REALTIME_EVENT = {
  FLOOR: "floor",
  KITCHEN: "kitchen",
  SESSION: "session",
} as const;
