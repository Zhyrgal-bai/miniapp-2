/**
 * Table reservation foundation (Phase 2–6E).
 *
 * Reservation deposit: depositAmount, depositPaidAt, depositPaymentId on TableReservation.
 */

export type DiningTableStatus =
  | "AVAILABLE"
  | "OCCUPIED"
  | "RESERVED"
  | "SOON_OCCUPIED";

export type TableReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "ARRIVED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type DiningTableShape = "SQUARE" | "RECTANGLE" | "CIRCLE" | "VIP";

export const ACTIVE_RESERVATION_STATUSES: TableReservationStatus[] = [
  "PENDING",
  "CONFIRMED",
  "ARRIVED",
];

export const DEFAULT_RESERVATION_DURATION_MIN = 90;
export const SLOT_STEP_MINUTES = 30;
export const SOON_OCCUPIED_MINUTES = 30;
export const REMINDER_LEAD_MINUTES = 30;

/** Venue hours for slot generation (local cafe day). */
export const VENUE_OPEN_HOUR = 9;
export const VENUE_CLOSE_HOUR = 23;

export const DINING_TABLE_STATUS_LABELS: Record<DiningTableStatus, string> = {
  AVAILABLE: "Свободен",
  OCCUPIED: "Занят",
  RESERVED: "Забронирован",
  SOON_OCCUPIED: "Скоро занят",
};

export const RESERVATION_STATUS_LABELS: Record<TableReservationStatus, string> = {
  PENDING: "Ожидает",
  CONFIRMED: "Подтверждена",
  ARRIVED: "Гость пришёл",
  COMPLETED: "Завершена",
  CANCELLED: "Отменена",
  NO_SHOW: "Не пришёл",
};

export function businessTypeSupportsTableReservations(
  businessType: string | null | undefined,
): boolean {
  const t = String(businessType ?? "").trim();
  return t === "coffee" || t === "fastfood";
}

export function reservationEndsAt(reservedAt: Date, durationMinutes: number): Date {
  return new Date(reservedAt.getTime() + durationMinutes * 60_000);
}

export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
