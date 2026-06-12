import { RefundRequestStatus } from "@prisma/client";
import { orderIsPaid } from "../../shared/orderCommerce.js";
import {
  REFUND_ACTIVE_STATUSES,
  finikExternalId,
  isRefundEligibleOrderStatus,
} from "../../shared/refundValidation.js";
import { prisma } from "../db.js";

export type RefundOrderRow = {
  id: number;
  businessId: number;
  status: string;
  total: number;
  paymentId: string | null;
  buyerUserId: number | null;
  orderNumber: string | null;
};

export async function loadRefundOrderForBusiness(
  businessId: number,
  orderId: number,
): Promise<RefundOrderRow | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId },
    select: {
      id: true,
      businessId: true,
      status: true,
      total: true,
      paymentId: true,
      buyerUserId: true,
      orderNumber: true,
    },
  });
  return order;
}

export function refundPaymentRefs(order: Pick<RefundOrderRow, "businessId" | "id" | "paymentId">): {
  paymentReference: string | null;
  externalReference: string;
} {
  return {
    paymentReference: order.paymentId?.trim() || null,
    externalReference: finikExternalId(order.businessId, order.id),
  };
}

export async function assertRefundOrderEligible(
  order: RefundOrderRow,
  opts?: { buyerUserId?: number },
): Promise<{ ok: true } | { ok: false; statusCode: number; error: string }> {
  if (opts?.buyerUserId != null && order.buyerUserId !== opts.buyerUserId) {
    return { ok: false, statusCode: 404, error: "Заказ не найден" };
  }
  if (order.buyerUserId == null) {
    return { ok: false, statusCode: 400, error: "У заказа нет покупателя" };
  }

  const st = String(order.status).trim().toUpperCase();
  if (st === "CANCELLED") {
    return { ok: false, statusCode: 400, error: "Заказ уже отменён" };
  }
  if (!orderIsPaid(order.status)) {
    return { ok: false, statusCode: 400, error: "Возврат доступен только для оплаченных заказов" };
  }
  if (!isRefundEligibleOrderStatus(order.status)) {
    return {
      ok: false,
      statusCode: 400,
      error: "Возврат денег доступен после оплаты и до доставки",
    };
  }

  const completed = await prisma.refundRequest.findFirst({
    where: {
      businessId: order.businessId,
      orderId: order.id,
      status: RefundRequestStatus.REFUNDED,
    },
    select: { id: true },
  });
  if (completed) {
    return { ok: false, statusCode: 400, error: "По этому заказу возврат уже выполнен" };
  }

  return { ok: true };
}

export async function findActiveRefundRequest(
  businessId: number,
  orderId: number,
): Promise<{ id: number } | null> {
  return prisma.refundRequest.findFirst({
    where: {
      businessId,
      orderId,
      status: { in: [...REFUND_ACTIVE_STATUSES] as RefundRequestStatus[] },
    },
    select: { id: true },
  });
}

export async function findActiveReturnRequest(
  businessId: number,
  orderId: number,
  userId: number,
): Promise<{ id: number } | null> {
  return prisma.returnRequest.findFirst({
    where: {
      businessId,
      orderId,
      userId,
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: { id: true },
  });
}
