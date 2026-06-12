import { RefundMethod } from "@prisma/client";
import type { RefundMethodWire } from "../../shared/refundValidation.js";
import { tryFinikRefund } from "./finikRefundAdapter.js";

export async function resolveRefundCompletion(input: {
  businessId: number;
  orderId: number;
  paymentReference: string | null;
  orderPaymentId: string | null;
  amountSom: number;
  methodWire: RefundMethodWire;
  merchantComment: string | null | undefined;
}): Promise<
  | {
      ok: true;
      refundMethod: RefundMethod;
      refundReference: string | null;
      transactionReference: string | null;
    }
  | { ok: false; statusCode: number; error: string }
> {
  const note = input.merchantComment?.trim() ?? "";

  if (input.methodWire === "MANUAL") {
    if (note.length === 0) {
      return {
        ok: false,
        statusCode: 400,
        error: "Для ручного возврата нужен комментарий магазина",
      };
    }
    return {
      ok: true,
      refundMethod: RefundMethod.MANUAL,
      refundReference: null,
      transactionReference: null,
    };
  }

  const paymentRef =
    input.paymentReference?.trim() || input.orderPaymentId?.trim() || null;

  if (input.methodWire === "FINIK" || input.methodWire === "AUTO") {
    const finik = await tryFinikRefund({
      businessId: input.businessId,
      orderId: input.orderId,
      paymentReference: paymentRef,
      amountSom: input.amountSom,
    });

    if (finik.ok) {
      return {
        ok: true,
        refundMethod: RefundMethod.FINIK,
        refundReference: finik.refundReference,
        transactionReference: finik.transactionReference ?? null,
      };
    }

    if (input.methodWire === "FINIK") {
      return { ok: false, statusCode: 502, error: finik.error };
    }

    if (note.length === 0) {
      return {
        ok: false,
        statusCode: 400,
        error: `${finik.error}. Укажите refundMethod=MANUAL и комментарий магазина.`,
      };
    }
    return {
      ok: true,
      refundMethod: RefundMethod.MANUAL,
      refundReference: null,
      transactionReference: null,
    };
  }

  return {
    ok: true,
    refundMethod: RefundMethod.MANUAL,
    refundReference: null,
    transactionReference: null,
  };
}
