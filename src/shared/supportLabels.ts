/** Human-facing Russian labels for support / orders UX (no enum jargon in UI). */

export const TICKET_TYPE_RU: Record<string, string> = {
  GENERAL: "Связаться с магазином",
  DELIVERY: "Вопрос по доставке",
  QUALITY: "Проблема с товаром",
  RETURN: "Возврат товара",
  EXCHANGE: "Обмен товара",
  CANCEL_REQUEST: "Отмена заказа",
  ADDRESS_CHANGE: "Изменение адреса",
  TRACKING: "Вопрос по треку",
  OTHER: "Другой вопрос",
};

export const RETURN_REASON_RU: Record<string, string> = {
  SIZE: "Не подошёл размер",
  DAMAGE: "Повреждение",
  WRONG_ITEM: "Неверный товар",
  QUALITY: "Качество",
  OTHER: "Другое",
};

/** Customer-facing ticket status (not CRM jargon). */
export const TICKET_STATUS_CUSTOMER_RU: Record<string, string> = {
  OPEN: "В работе",
  PENDING_CUSTOMER: "Ждём ваш ответ",
  PENDING_MERCHANT: "Магазин отвечает",
  RESOLVED: "Решено",
  CLOSED: "Закрыто",
};

export const MESSAGE_SENDER_CUSTOMER_RU: Record<string, string> = {
  CUSTOMER: "Вы",
  MERCHANT: "Магазин",
  SYSTEM: "Поддержка",
};

export type OrderTimelineStep = {
  key: string;
  icon: string;
  label: string;
  state: "done" | "current" | "upcoming" | "cancelled";
};

/** Visual order progression for «Мои заказы». */
export function orderTimelineSteps(status: string): OrderTimelineStep[] {
  const u = status.toUpperCase();

  if (u === "CANCELLED") {
    return [
      { key: "placed", icon: "✅", label: "Заказ принят", state: "done" },
      { key: "cancelled", icon: "❌", label: "Заказ отменён", state: "cancelled" },
    ];
  }

  const steps: Omit<OrderTimelineStep, "state">[] = [
    { key: "placed", icon: "✅", label: "Заказ принят" },
    { key: "preparing", icon: "📦", label: "Собирается" },
    { key: "shipping", icon: "🚚", label: "Передан в доставку" },
    { key: "delivered", icon: "🎉", label: "Доставлен" },
  ];

  let currentIdx = 0;
  if (u === "NEW" || u === "ACCEPTED" || u === "PAID_PENDING") currentIdx = 0;
  else if (u === "CONFIRMED") currentIdx = 1;
  else if (u === "SHIPPED") currentIdx = 2;
  else if (u === "DELIVERED") currentIdx = 3;

  return steps.map((s, i) => ({
    ...s,
    state:
      i < currentIdx ? "done" : i === currentIdx ? "current" : "upcoming",
  }));
}

export function ticketTypeLabelRu(type: string | null | undefined): string {
  if (type == null || String(type).trim() === "") return "Обращение";
  const key = String(type).trim().toUpperCase();
  return TICKET_TYPE_RU[key] ?? "Обращение";
}

export function returnReasonLabelRu(reason: string | null | undefined): string {
  if (reason == null || String(reason).trim() === "") return "—";
  const key = String(reason).trim().toUpperCase();
  return RETURN_REASON_RU[key] ?? reason;
}
