/**
 * Commerce phases for customer order actions (maps DB OrderStatus → UX logic).
 * Not a DB enum — presentation + eligibility layer.
 */

export type OrderCommercePhase =
  | "BEFORE_PAYMENT"
  | "PAID_IN_FULFILLMENT"
  | "SHIPPING"
  | "DELIVERED"
  | "CANCELLED";

const PAID_STATUSES = new Set(["CONFIRMED", "SHIPPED", "DELIVERED"]);
const UNPAID_STATUSES = new Set(["NEW", "ACCEPTED", "PAID_PENDING"]);

export function orderCommercePhase(status: string): OrderCommercePhase {
  const u = String(status ?? "").trim().toUpperCase();
  if (u === "CANCELLED") return "CANCELLED";
  if (u === "DELIVERED") return "DELIVERED";
  if (u === "SHIPPED") return "SHIPPING";
  if (u === "CONFIRMED") return "PAID_IN_FULFILLMENT";
  if (UNPAID_STATUSES.has(u)) return "BEFORE_PAYMENT";
  return "BEFORE_PAYMENT";
}

export function orderIsPaid(status: string): boolean {
  return PAID_STATUSES.has(String(status ?? "").trim().toUpperCase());
}

export type CustomerActionKind =
  | "cancel"
  | "refund"
  | "return"
  | "address"
  | "exchange"
  | "quality"
  | "tracking"
  | "delivery"
  | "chat";

export type CustomerOrderAction = {
  key: string;
  label: string;
  kind: CustomerActionKind;
  description?: string;
};

export function customerOrderActions(
  phase: OrderCommercePhase
): CustomerOrderAction[] {
  switch (phase) {
    case "BEFORE_PAYMENT":
      return [
        {
          key: "cancel",
          label: "Отменить заказ",
          kind: "cancel",
          description: "До оплаты — без возврата денег",
        },
        {
          key: "address",
          label: "Изменить адрес",
          kind: "address",
        },
        {
          key: "chat",
          label: "Связаться с магазином",
          kind: "chat",
        },
      ];
    case "PAID_IN_FULFILLMENT":
      return [
        {
          key: "refund",
          label: "Запросить возврат денег",
          kind: "refund",
          description: "Пока заказ ещё не отправлен",
        },
        {
          key: "address",
          label: "Изменить адрес",
          kind: "address",
        },
        {
          key: "chat",
          label: "Связаться с магазином",
          kind: "chat",
        },
      ];
    case "SHIPPING":
      return [
        {
          key: "refund",
          label: "Запросить возврат денег",
          kind: "refund",
          description: "До получения посылки",
        },
        {
          key: "tracking",
          label: "Где посылка?",
          kind: "tracking",
        },
        {
          key: "delivery",
          label: "Вопрос по доставке",
          kind: "delivery",
        },
        {
          key: "chat",
          label: "Связаться с магазином",
          kind: "chat",
        },
      ];
    case "DELIVERED":
      return [
        {
          key: "return",
          label: "Возврат товара",
          kind: "return",
        },
        {
          key: "quality",
          label: "Проблема с товаром",
          kind: "quality",
        },
        {
          key: "exchange",
          label: "Обмен",
          kind: "exchange",
        },
        {
          key: "chat",
          label: "Связаться с магазином",
          kind: "chat",
        },
      ];
    case "CANCELLED":
      return [
        {
          key: "chat",
          label: "Задать вопрос",
          kind: "chat",
        },
      ];
    default:
      return [
        {
          key: "chat",
          label: "Связаться с магазином",
          kind: "chat",
        },
      ];
  }
}

export function commercePhaseLabelRu(phase: OrderCommercePhase): string {
  switch (phase) {
    case "BEFORE_PAYMENT":
      return "Ожидаем оплату";
    case "PAID_IN_FULFILLMENT":
      return "Оплачен · готовится";
    case "SHIPPING":
      return "В пути";
    case "DELIVERED":
      return "Доставлен";
    case "CANCELLED":
      return "Отменён";
    default:
      return phase;
  }
}
