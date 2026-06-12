/**
 * Finik refund adapter (P1 scaffold).
 * Plugs into REFUNDED transition when Finik documents a refund API.
 * Does NOT call payment create or webhook handlers.
 */

export type FinikRefundAttemptResult =
  | {
      ok: true;
      refundReference: string;
      transactionReference?: string;
    }
  | {
      ok: false;
      code: "not_available" | "failed";
      error: string;
    };

export async function tryFinikRefund(input: {
  businessId: number;
  orderId: number;
  paymentReference: string | null;
  amountSom: number;
}): Promise<FinikRefundAttemptResult> {
  void input;
  return {
    ok: false,
    code: "not_available",
    error: "Finik refund API не подключён — используйте MANUAL с комментарием магазина",
  };
}

export function isFinikRefundAvailable(): boolean {
  return false;
}
