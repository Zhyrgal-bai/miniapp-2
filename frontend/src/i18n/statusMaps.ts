/** Maps server enum codes → Russian labels for admin/support UI. */

export const ORDER_STATUS_RU: Record<string, string> = {
  NEW: "Новый",
  ACCEPTED: "Принят",
  PAID_PENDING: "Ожидает оплаты",
  CONFIRMED: "Оплачен",
  SHIPPED: "Отправлен",
  DELIVERED: "Доставлен",
  CANCELLED: "Отменён",
};

export const TICKET_STATUS_RU: Record<string, string> = {
  OPEN: "Открыт",
  PENDING_CUSTOMER: "Ждём клиента",
  PENDING_MERCHANT: "Ждём магазин",
  RESOLVED: "Решён",
  CLOSED: "Закрыт",
};

export const TICKET_SENDER_RU: Record<string, string> = {
  CUSTOMER: "Клиент",
  MERCHANT: "Магазин",
  SYSTEM: "Система",
};

export const RETURN_STATUS_RU: Record<string, string> = {
  PENDING: "На рассмотрении",
  APPROVED: "Одобрен",
  REJECTED: "Отклонён",
  COMPLETED: "Завершён",
  REFUNDED: "Возврат средств",
  RETURNED: "Товар возвращён",
};

export const MEMBERSHIP_ROLE_RU: Record<string, string> = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  CLIENT: "Клиент",
};

export const SUBSCRIPTION_STATUS_RU: Record<string, string> = {
  TRIAL: "Пробный период",
  ACTIVE: "Активна",
  INACTIVE: "Неактивна",
  EXPIRED: "Истекла",
  PAST_DUE: "Просрочена",
  CANCELED: "Отменена",
};

export function mapStatus(
  code: string | null | undefined,
  map: Record<string, string>,
  fallback = "—",
): string {
  if (code == null || String(code).trim() === "") return fallback;
  const key = String(code).trim().toUpperCase();
  return map[key] ?? code;
}
