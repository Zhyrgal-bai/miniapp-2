/** Customer/merchant-facing Finik payment states (derived from order, no enum jargon). */

export type FinikPaymentUiState =
  | "awaiting"
  | "checking"
  | "paid"
  | "failed"
  | "expired";

export type FinikPaymentStateView = {
  key: FinikPaymentUiState;
  label: string;
  hint?: string;
};

const PAID_ORDER_STATUSES = new Set([
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
]);

export function isFinikPaymentMethod(paymentMethod: string | null | undefined): boolean {
  return String(paymentMethod ?? "").trim().toLowerCase() === "finik";
}

export function finikPaymentStateView(input: {
  orderStatus: string;
  paymentMethod?: string | null;
  /** Client-side: user returned from Finik and we poll. */
  polling?: boolean;
  /** Client-side: poll timed out. */
  timedOut?: boolean;
}): FinikPaymentStateView | null {
  if (!isFinikPaymentMethod(input.paymentMethod)) return null;

  const st = String(input.orderStatus ?? "").trim().toUpperCase();

  if (st === "CANCELLED") {
    return {
      key: "failed",
      label: "Оплата отменена",
      hint: "Заказ отменён. При необходимости оформите новый.",
    };
  }

  if (PAID_ORDER_STATUSES.has(st)) {
    return {
      key: "paid",
      label: "Оплачено",
      hint: "Оплата подтверждена автоматически через Finik.",
    };
  }

  if (input.timedOut) {
    return {
      key: "expired",
      label: "Время оплаты истекло",
      hint: "Попробуйте оплатить снова из «Мои заказы» или оформите заказ заново.",
    };
  }

  if (input.polling) {
    return {
      key: "checking",
      label: "Проверяем оплату",
      hint: "Обычно это занимает до минуты после оплаты.",
    };
  }

  return {
    key: "awaiting",
    label: "Ожидаем оплату",
    hint: "Завершите оплату на странице Finik — статус обновится автоматически.",
  };
}

export function finikOrderIsAwaitingPayment(orderStatus: string): boolean {
  const st = String(orderStatus ?? "").trim().toUpperCase();
  return st === "NEW" || st === "ACCEPTED" || st === "PAID_PENDING";
}
