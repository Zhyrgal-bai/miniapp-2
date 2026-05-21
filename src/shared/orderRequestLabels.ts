import type { OrderCommercePhase } from "./orderCommerce.js";

/** Customer-facing labels for cancel / refund / return request statuses. */

export const CANCEL_STATUS_RU: Record<string, string> = {
  PENDING: "На рассмотрении",
  APPROVED: "Отмена одобрена",
  REJECTED: "Отмена отклонена",
};

export const REFUND_STATUS_RU: Record<string, string> = {
  REQUESTED: "Заявка отправлена",
  REVIEWING: "На проверке",
  APPROVED: "Возврат одобрен",
  REJECTED: "Возврат отклонён",
  REFUNDED: "Деньги возвращены",
};

export const RETURN_STATUS_CUSTOMER_RU: Record<string, string> = {
  PENDING: "Заявка отправлена",
  APPROVED: "Одобрено",
  REJECTED: "Отклонено",
  RETURNED: "Товар получен магазином",
  REFUNDED: "Завершено",
};

export function cancelStatusLabelRu(code: string | null | undefined): string {
  if (code == null) return "—";
  return CANCEL_STATUS_RU[String(code).trim().toUpperCase()] ?? code;
}

export function refundStatusLabelRu(code: string | null | undefined): string {
  if (code == null) return "—";
  return REFUND_STATUS_RU[String(code).trim().toUpperCase()] ?? code;
}

export function returnStatusCustomerRu(code: string | null | undefined): string {
  if (code == null) return "—";
  return RETURN_STATUS_CUSTOMER_RU[String(code).trim().toUpperCase()] ?? code;
}

/** Timeline steps for an in-flight request card. */
export function requestTimelineSteps(
  kind: "cancel" | "refund" | "return",
  status: string
): Array<{ label: string; done: boolean; current: boolean }> {
  const s = String(status).trim().toUpperCase();
  if (kind === "cancel") {
    return [
      { label: "Заявка отправлена", done: true, current: s === "PENDING" },
      {
        label: "Решение магазина",
        done: s === "APPROVED" || s === "REJECTED",
        current: s === "PENDING",
      },
      {
        label: s === "REJECTED" ? "Отклонено" : "Заказ отменён",
        done: s === "APPROVED" || s === "REJECTED",
        current: s === "APPROVED" || s === "REJECTED",
      },
    ];
  }
  if (kind === "refund") {
    return [
      { label: "Заявка отправлена", done: true, current: s === "REQUESTED" },
      {
        label: "Проверка магазином",
        done: ["REVIEWING", "APPROVED", "REJECTED", "REFUNDED"].includes(s),
        current: s === "REQUESTED" || s === "REVIEWING",
      },
      {
        label: "Возврат денег",
        done: s === "REFUNDED",
        current: s === "APPROVED",
      },
    ];
  }
  return [
    { label: "Заявка отправлена", done: true, current: s === "PENDING" },
    {
      label: "Решение магазина",
      done: ["APPROVED", "REJECTED", "RETURNED", "REFUNDED"].includes(s),
      current: s === "PENDING",
    },
    {
      label: "Товар у магазина",
      done: ["RETURNED", "REFUNDED"].includes(s),
      current: s === "APPROVED",
    },
  ];
}

export function orderTimelineForPhase(phase: OrderCommercePhase): Array<{
  icon: string;
  label: string;
}> {
  switch (phase) {
    case "BEFORE_PAYMENT":
      return [
        { icon: "🛒", label: "Заказ оформлен" },
        { icon: "💳", label: "Ожидаем оплату" },
      ];
    case "PAID_IN_FULFILLMENT":
      return [
        { icon: "✅", label: "Оплачено" },
        { icon: "📦", label: "Собирается" },
      ];
    case "SHIPPING":
      return [
        { icon: "✅", label: "Оплачено" },
        { icon: "🚚", label: "В пути" },
      ];
    case "DELIVERED":
      return [
        { icon: "✅", label: "Оплачено" },
        { icon: "🎉", label: "Доставлено" },
      ];
    case "CANCELLED":
      return [{ icon: "❌", label: "Отменён" }];
    default:
      return [{ icon: "•", label: "Заказ" }];
  }
}
