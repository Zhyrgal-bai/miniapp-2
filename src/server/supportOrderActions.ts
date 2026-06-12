import {
  CancelRequestStatus,
  RefundAuditActorType,
  RefundMethod,
  RefundRequestStatus,
  SupportSenderType,
  SupportTicketStatus,
} from "@prisma/client";
import { orderCommercePhase, orderIsPaid } from "../shared/orderCommerce.js";
import {
  parseRefundMethod,
  validateRefundAmount,
  type RefundMethodWire,
} from "../shared/refundValidation.js";
import { prisma } from "./db.js";
import { orderDisplayLabel } from "../shared/orderDisplay.js";
import { appendRefundAuditLog } from "./refund/refundAuditService.js";
import { resolveRefundCompletion } from "./refund/refundCompletion.js";
import {
  assertRefundOrderEligible,
  findActiveRefundRequest,
  loadRefundOrderForBusiness,
  refundPaymentRefs,
} from "./refund/refundEligibility.js";
import {
  notifyCustomerRefundStatus,
  notifyMerchantRefundEvent,
} from "./refund/refundNotifyService.js";
import { applyRefundReversals } from "./refund/refundReversalService.js";

async function appendSupportSystemMessage(opts: {
  businessId: number;
  orderId: number;
  userId: number;
  text: string;
}): Promise<void> {
  const { businessId, orderId, userId, text } = opts;
  let ticket = await prisma.supportTicket.findFirst({
    where: {
      businessId,
      userId,
      orderId,
      status: { notIn: [SupportTicketStatus.CLOSED, SupportTicketStatus.RESOLVED] },
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!ticket) {
    ticket = await prisma.supportTicket.create({
      data: {
        businessId,
        userId,
        orderId,
        type: "GENERAL",
        status: SupportTicketStatus.OPEN,
      },
    });
  }
  await prisma.supportMessage.create({
    data: {
      ticketId: ticket.id,
      businessId,
      senderType: SupportSenderType.SYSTEM,
      senderId: null,
      text,
      attachments: [],
    },
  });
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { updatedAt: new Date() },
  });
}

async function archiveSupportThreads(
  businessId: number,
  orderId: number,
  userId: number,
): Promise<void> {
  await prisma.supportTicket.updateMany({
    where: {
      businessId,
      orderId,
      userId,
      status: { notIn: [SupportTicketStatus.CLOSED] },
    },
    data: { status: SupportTicketStatus.CLOSED },
  });
}

async function createRefundRequestRow(input: {
  businessId: number;
  orderId: number;
  userId: number;
  reason?: string;
  comment?: string | null;
  initiatedByMerchant: boolean;
  actorType: RefundAuditActorType;
  actorUserId?: number | null;
  paymentReference: string | null;
  externalReference: string;
}): Promise<{ id: number; orderNumber: string | null; orderTotal: number }> {
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.refundRequest.create({
      data: {
        businessId: input.businessId,
        orderId: input.orderId,
        userId: input.userId,
        reason: input.reason?.trim().slice(0, 200) || null,
        comment: input.comment?.trim().slice(0, 2000) || null,
        status: RefundRequestStatus.REQUESTED,
        initiatedByMerchant: input.initiatedByMerchant,
        paymentReference: input.paymentReference,
        externalReference: input.externalReference,
      },
      include: { order: { select: { orderNumber: true, total: true } } },
    });

    await appendRefundAuditLog(tx, {
      refundRequestId: created.id,
      businessId: input.businessId,
      orderId: input.orderId,
      actorType: input.actorType,
      actorUserId: input.actorUserId ?? null,
      fromStatus: null,
      toStatus: RefundRequestStatus.REQUESTED,
      paymentReference: input.paymentReference,
      merchantNote: input.comment ?? null,
    });

    return created;
  });

  return {
    id: row.id,
    orderNumber: row.order.orderNumber,
    orderTotal: row.order.total,
  };
}

export async function createCancelRequestForOrder(opts: {
  businessId: number;
  orderId: number;
  userId: number;
  reason?: string;
  comment?: string;
}): Promise<{ ok: true; row: unknown } | { ok: false; statusCode: number; error: string }> {
  const order = await prisma.order.findFirst({
    where: {
      id: opts.orderId,
      businessId: opts.businessId,
      buyerUserId: opts.userId,
    },
  });
  if (!order) {
    return { ok: false, statusCode: 404, error: "Заказ не найден" };
  }
  const phase = orderCommercePhase(order.status);
  if (phase !== "BEFORE_PAYMENT") {
    return {
      ok: false,
      statusCode: 400,
      error: "Отмена доступна только до оплаты заказа",
    };
  }
  if (orderIsPaid(order.status)) {
    return {
      ok: false,
      statusCode: 400,
      error: "Заказ уже оплачен — используйте «Возврат денег»",
    };
  }

  const pending = await prisma.cancelRequest.findFirst({
    where: {
      businessId: opts.businessId,
      orderId: opts.orderId,
      userId: opts.userId,
      status: CancelRequestStatus.PENDING,
    },
  });
  if (pending) {
    return {
      ok: false,
      statusCode: 400,
      error: "Заявка на отмену уже на рассмотрении",
    };
  }

  const row = await prisma.cancelRequest.create({
    data: {
      businessId: opts.businessId,
      orderId: opts.orderId,
      userId: opts.userId,
      reason: opts.reason?.trim().slice(0, 200) || null,
      comment: opts.comment?.trim().slice(0, 2000) || null,
      status: CancelRequestStatus.PENDING,
    },
  });

  const label = orderDisplayLabel(order);
  await appendSupportSystemMessage({
    businessId: opts.businessId,
    orderId: opts.orderId,
    userId: opts.userId,
    text: `Заявка на отмену заказа ${label}${opts.comment?.trim() ? `.\n\n${opts.comment.trim()}` : "."}`,
  });

  const { createMerchantNotification } = await import("./merchantNotificationsService.js");
  void createMerchantNotification({
    businessId: opts.businessId,
    kind: "CANCEL_REQUEST",
    title: "Заявка на отмену заказа",
    body: orderDisplayLabel(order),
    href: "/admin/support?tab=cancellations",
  });

  return { ok: true, row };
}

export async function createRefundRequestForOrder(opts: {
  businessId: number;
  orderId: number;
  userId: number;
  reason?: string;
  comment?: string;
}): Promise<{ ok: true; row: unknown } | { ok: false; statusCode: number; error: string }> {
  const order = await loadRefundOrderForBusiness(opts.businessId, opts.orderId);
  if (!order) {
    return { ok: false, statusCode: 404, error: "Заказ не найден" };
  }

  const eligible = await assertRefundOrderEligible(order, { buyerUserId: opts.userId });
  if (!eligible.ok) return eligible;

  const active = await findActiveRefundRequest(opts.businessId, opts.orderId);
  if (active) {
    return {
      ok: false,
      statusCode: 400,
      error: "Заявка на возврат денег уже в работе",
    };
  }

  const refs = refundPaymentRefs(order);
  const created = await createRefundRequestRow({
    businessId: opts.businessId,
    orderId: opts.orderId,
    userId: opts.userId,
    ...(opts.reason !== undefined ? { reason: opts.reason } : {}),
    ...(opts.comment !== undefined ? { comment: opts.comment } : {}),
    initiatedByMerchant: false,
    actorType: RefundAuditActorType.CUSTOMER,
    actorUserId: opts.userId,
    paymentReference: refs.paymentReference,
    externalReference: refs.externalReference,
  });

  const label = orderDisplayLabel({ id: order.id, orderNumber: order.orderNumber });
  await appendSupportSystemMessage({
    businessId: opts.businessId,
    orderId: opts.orderId,
    userId: opts.userId,
    text: `Заявка на возврат денег по заказу ${label}${opts.comment?.trim() ? `.\n\n${opts.comment.trim()}` : "."}`,
  });

  void notifyMerchantRefundEvent({
    businessId: opts.businessId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    kind: "customer_requested",
  });

  void notifyCustomerRefundStatus({
    businessId: opts.businessId,
    userId: opts.userId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: RefundRequestStatus.REQUESTED,
    orderTotal: order.total,
  });

  const row = await prisma.refundRequest.findUnique({ where: { id: created.id } });
  return { ok: true, row };
}

export async function createRefundRequestByMerchant(opts: {
  businessId: number;
  orderId: number;
  actorUserId: number;
  reason?: string;
  comment?: string;
  merchantComment?: string;
}): Promise<{ ok: true; row: unknown } | { ok: false; statusCode: number; error: string }> {
  const order = await loadRefundOrderForBusiness(opts.businessId, opts.orderId);
  if (!order) {
    return { ok: false, statusCode: 404, error: "Заказ не найден" };
  }

  const eligible = await assertRefundOrderEligible(order);
  if (!eligible.ok) return eligible;

  if (order.buyerUserId == null) {
    return { ok: false, statusCode: 400, error: "У заказа нет покупателя" };
  }

  const active = await findActiveRefundRequest(opts.businessId, opts.orderId);
  if (active) {
    return {
      ok: false,
      statusCode: 400,
      error: "Заявка на возврат денег уже в работе",
    };
  }

  const refs = refundPaymentRefs(order);
  const note = opts.merchantComment?.trim() || opts.comment?.trim() || opts.reason?.trim();
  const merchantCreatePayload: {
    businessId: number;
    orderId: number;
    userId: number;
    reason: string;
    initiatedByMerchant: true;
    actorType: typeof RefundAuditActorType.MERCHANT;
    actorUserId: number;
    paymentReference: string | null;
    externalReference: string;
    comment?: string | null;
  } = {
    businessId: opts.businessId,
    orderId: opts.orderId,
    userId: order.buyerUserId,
    reason: opts.reason ?? "Инициировано магазином",
    initiatedByMerchant: true,
    actorType: RefundAuditActorType.MERCHANT,
    actorUserId: opts.actorUserId,
    paymentReference: refs.paymentReference,
    externalReference: refs.externalReference,
  };
  if (opts.comment !== undefined) {
    merchantCreatePayload.comment = opts.comment;
  } else if (note) {
    merchantCreatePayload.comment = note;
  }
  const created = await createRefundRequestRow(merchantCreatePayload);

  const label = orderDisplayLabel({ id: order.id, orderNumber: order.orderNumber });
  await appendSupportSystemMessage({
    businessId: opts.businessId,
    orderId: opts.orderId,
    userId: order.buyerUserId,
    text: `Магазин открыл заявку на возврат по заказу ${label}.${note ? `\n\n${note}` : ""}`,
  });

  void notifyCustomerRefundStatus({
    businessId: opts.businessId,
    userId: order.buyerUserId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: RefundRequestStatus.REQUESTED,
    orderTotal: order.total,
  });

  void notifyMerchantRefundEvent({
    businessId: opts.businessId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    kind: "created",
    initiatedByMerchant: true,
  });

  const row = await prisma.refundRequest.findUnique({ where: { id: created.id } });
  return { ok: true, row };
}

function allowedCancelTransition(
  from: CancelRequestStatus,
  to: CancelRequestStatus,
): boolean {
  if (from === to) return true;
  return (
    from === CancelRequestStatus.PENDING &&
    (to === CancelRequestStatus.APPROVED || to === CancelRequestStatus.REJECTED)
  );
}

function allowedRefundTransition(
  from: RefundRequestStatus,
  to: RefundRequestStatus,
): boolean {
  const m: Record<RefundRequestStatus, RefundRequestStatus[]> = {
    REQUESTED: ["REVIEWING", "APPROVED", "REJECTED"],
    REVIEWING: ["APPROVED", "REJECTED"],
    APPROVED: ["REFUNDED", "REJECTED"],
    REJECTED: [],
    REFUNDED: [],
  };
  return m[from]?.includes(to) ?? false;
}

async function resolveRefundCompletionForRow(
  existing: {
    id: number;
    businessId: number;
    orderId: number;
    paymentReference: string | null;
    order: { paymentId: string | null };
  },
  amountSom: number,
  methodWire: RefundMethodWire,
  merchantComment: string | null | undefined,
): Promise<
  | {
      ok: true;
      refundMethod: RefundMethod;
      refundReference: string | null;
      transactionReference: string | null;
    }
  | { ok: false; statusCode: number; error: string }
> {
  return resolveRefundCompletion({
    businessId: existing.businessId,
    orderId: existing.orderId,
    paymentReference: existing.paymentReference,
    orderPaymentId: existing.order.paymentId,
    amountSom,
    methodWire,
    merchantComment,
  });
}

export async function patchCancelRequestMerchant(opts: {
  businessId: number;
  cancelId: number;
  status: CancelRequestStatus;
  merchantComment?: string | null;
}): Promise<{ ok: true; row: unknown } | { ok: false; statusCode: number; error: string }> {
  const existing = await prisma.cancelRequest.findFirst({
    where: { id: opts.cancelId, businessId: opts.businessId },
    include: { order: true },
  });
  if (!existing) {
    return { ok: false, statusCode: 404, error: "Не найдено" };
  }
  if (!allowedCancelTransition(existing.status, opts.status)) {
    return { ok: false, statusCode: 400, error: "Неверный переход статуса" };
  }

  const row = await prisma.$transaction(async (tx) => {
    const updateData: {
      status: CancelRequestStatus;
      merchantComment?: string | null;
    } = { status: opts.status };
    if (opts.merchantComment !== undefined) {
      updateData.merchantComment =
        opts.merchantComment?.trim().slice(0, 2000) || null;
    }
    const updated = await tx.cancelRequest.update({
      where: { id: existing.id },
      data: updateData,
    });

    if (opts.status === CancelRequestStatus.APPROVED) {
      await tx.order.update({
        where: { id: existing.orderId },
        data: {
          status: "CANCELLED",
          paymentId: null,
        },
      });
    }

    return updated;
  });

  if (opts.status === CancelRequestStatus.APPROVED) {
    await archiveSupportThreads(
      existing.businessId,
      existing.orderId,
      existing.userId,
    );
    const { onOrderCancelled } = await import("./orderInventoryHooks.js");
    await onOrderCancelled(existing.orderId, existing.order.status);
  }

  const msg =
    opts.status === CancelRequestStatus.APPROVED
      ? `Отмена заказа ${orderDisplayLabel(existing.order)} одобрена.${opts.merchantComment?.trim() ? `\n\n${opts.merchantComment.trim()}` : ""}`
      : opts.status === CancelRequestStatus.REJECTED
        ? `Заявка на отмену отклонена.${opts.merchantComment?.trim() ? `\n\n${opts.merchantComment.trim()}` : ""}`
        : null;

  if (msg) {
    await appendSupportSystemMessage({
      businessId: existing.businessId,
      orderId: existing.orderId,
      userId: existing.userId,
      text: msg,
    });
  }

  return { ok: true, row };
}

export async function patchRefundRequestMerchant(opts: {
  businessId: number;
  refundId: number;
  status: RefundRequestStatus;
  merchantComment?: string | null;
  refundAmount?: number | null;
  refundMethod?: RefundMethodWire | null;
  actorUserId?: number | null;
}): Promise<{ ok: true; row: unknown } | { ok: false; statusCode: number; error: string }> {
  const existing = await prisma.refundRequest.findFirst({
    where: { id: opts.refundId, businessId: opts.businessId },
    include: { order: true },
  });
  if (!existing) {
    return { ok: false, statusCode: 404, error: "Не найдено" };
  }

  if (existing.status === RefundRequestStatus.REFUNDED) {
    return { ok: false, statusCode: 409, error: "Возврат уже выполнен" };
  }

  if (!allowedRefundTransition(existing.status, opts.status)) {
    return { ok: false, statusCode: 400, error: "Неверный переход статуса" };
  }

  const orderEligible = await assertRefundOrderEligible(
    {
      id: existing.orderId,
      businessId: existing.businessId,
      status: existing.order.status,
      total: existing.order.total,
      paymentId: existing.order.paymentId,
      buyerUserId: existing.userId,
      orderNumber: existing.order.orderNumber,
    },
    opts.status === RefundRequestStatus.REFUNDED
      ? undefined
      : { buyerUserId: existing.userId },
  );
  if (opts.status === RefundRequestStatus.REFUNDED && !orderEligible.ok) {
    return orderEligible;
  }

  let resolvedAmount: number | undefined;
  if (opts.status === RefundRequestStatus.REFUNDED) {
    const amountInput =
      opts.refundAmount !== undefined && opts.refundAmount !== null
        ? opts.refundAmount
        : existing.refundAmount ?? existing.order.total;
    const validated = validateRefundAmount(amountInput, existing.order.total);
    if (!validated.ok) {
      return { ok: false, statusCode: 400, error: validated.error };
    }
    resolvedAmount = validated.amount;
  } else if (opts.refundAmount !== undefined && opts.refundAmount !== null) {
    const validated = validateRefundAmount(opts.refundAmount, existing.order.total);
    if (!validated.ok) {
      return { ok: false, statusCode: 400, error: validated.error };
    }
    resolvedAmount = validated.amount;
  }

  let completion:
    | {
        refundMethod: RefundMethod;
        refundReference: string | null;
        transactionReference: string | null;
      }
    | undefined;

  if (opts.status === RefundRequestStatus.REFUNDED) {
    const methodWire = opts.refundMethod ?? "AUTO";
    const resolved = await resolveRefundCompletionForRow(
      existing,
      resolvedAmount!,
      methodWire,
      opts.merchantComment,
    );
    if (!resolved.ok) return resolved;
    completion = {
      refundMethod: resolved.refundMethod,
      refundReference: resolved.refundReference,
      transactionReference: resolved.transactionReference,
    };
  }

  const priorOrderStatus = existing.order.status;
  let updatedRow: typeof existing;

  try {
    updatedRow = await prisma.$transaction(async (tx) => {
      if (opts.status === RefundRequestStatus.REFUNDED) {
        const already = await tx.refundRequest.findFirst({
          where: {
            orderId: existing.orderId,
            status: RefundRequestStatus.REFUNDED,
            id: { not: existing.id },
          },
          select: { id: true },
        });
        if (already) {
          throw new Error("REFUND_ALREADY_COMPLETED");
        }
      }

      const updateResult = await tx.refundRequest.updateMany({
        where: {
          id: existing.id,
          businessId: opts.businessId,
          status: existing.status,
        },
        data: {
          status: opts.status,
          ...(opts.merchantComment !== undefined
            ? {
                merchantComment:
                  opts.merchantComment?.trim().slice(0, 2000) || null,
              }
            : {}),
          ...(resolvedAmount !== undefined ? { refundAmount: resolvedAmount } : {}),
          ...(completion
            ? {
                refundMethod: completion.refundMethod,
                refundReference: completion.refundReference,
                transactionReference: completion.transactionReference,
                ...(opts.status === RefundRequestStatus.REFUNDED
                  ? { refundedAt: new Date() }
                  : {}),
                paymentReference:
                  existing.paymentReference ??
                  existing.order.paymentId?.trim() ??
                  null,
              }
            : {}),
        },
      });

      if (updateResult.count === 0) {
        throw new Error("REFUND_CONFLICT");
      }

      if (opts.status === RefundRequestStatus.REFUNDED) {
        await tx.order.update({
          where: { id: existing.orderId, status: { not: "CANCELLED" } },
          data: { status: "CANCELLED", paymentId: null },
        });
      }

      const updated = await tx.refundRequest.findUniqueOrThrow({
        where: { id: existing.id },
        include: { order: true },
      });

      await appendRefundAuditLog(tx, {
        refundRequestId: existing.id,
        businessId: existing.businessId,
        orderId: existing.orderId,
        actorType: RefundAuditActorType.MERCHANT,
        actorUserId: opts.actorUserId ?? null,
        fromStatus: existing.status,
        toStatus: opts.status,
        refundAmount: resolvedAmount ?? existing.refundAmount,
        refundMethod: completion?.refundMethod ?? updated.refundMethod,
        paymentReference:
          updated.paymentReference ?? updated.order.paymentId ?? null,
        merchantNote: opts.merchantComment ?? updated.merchantComment,
      });

      return updated;
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "REFUND_ALREADY_COMPLETED" || msg === "REFUND_CONFLICT") {
      return { ok: false, statusCode: 409, error: "Возврат уже выполнен или статус изменился" };
    }
    throw e;
  }

  if (opts.status === RefundRequestStatus.REFUNDED) {
    await archiveSupportThreads(
      existing.businessId,
      existing.orderId,
      existing.userId,
    );
    const { onOrderCancelled } = await import("./orderInventoryHooks.js");
    await onOrderCancelled(existing.orderId, priorOrderStatus);
    await applyRefundReversals(existing.orderId);

    void notifyCustomerRefundStatus({
      businessId: existing.businessId,
      userId: existing.userId,
      orderId: existing.orderId,
      orderNumber: existing.order.orderNumber,
      status: RefundRequestStatus.REFUNDED,
      refundAmount: resolvedAmount ?? existing.refundAmount,
      orderTotal: existing.order.total,
    });

    void notifyMerchantRefundEvent({
      businessId: existing.businessId,
      orderId: existing.orderId,
      orderNumber: existing.order.orderNumber,
      kind: "completed",
      refundAmount: resolvedAmount ?? existing.refundAmount,
    });
  } else {
    void notifyCustomerRefundStatus({
      businessId: existing.businessId,
      userId: existing.userId,
      orderId: existing.orderId,
      orderNumber: existing.order.orderNumber,
      status: opts.status,
      refundAmount: resolvedAmount ?? existing.refundAmount,
      orderTotal: existing.order.total,
    });
  }

  const statusMsg: Partial<Record<RefundRequestStatus, string>> = {
    REVIEWING: "Заявка на возврат денег принята на проверку.",
    APPROVED: "Возврат денег одобрен. Ожидайте зачисления.",
    REJECTED: "Заявка на возврат денег отклонена.",
    REFUNDED: `Возврат ${resolvedAmount ?? existing.refundAmount ?? existing.order.total} сом выполнен.`,
  };
  const base = statusMsg[opts.status];
  if (base) {
    const methodNote =
      opts.status === RefundRequestStatus.REFUNDED && completion
        ? `\n\nСпособ: ${completion.refundMethod}`
        : "";
    await appendSupportSystemMessage({
      businessId: existing.businessId,
      orderId: existing.orderId,
      userId: existing.userId,
      text: opts.merchantComment?.trim()
        ? `${base}${methodNote}\n\n${opts.merchantComment.trim()}`
        : `${base}${methodNote}`,
    });
  }

  return { ok: true, row: updatedRow };
}

export async function listRefundAuditLogs(
  businessId: number,
  refundId: number,
): Promise<unknown[]> {
  const row = await prisma.refundRequest.findFirst({
    where: { id: refundId, businessId },
    select: { id: true },
  });
  if (!row) return [];
  return prisma.refundAuditLog.findMany({
    where: { refundRequestId: refundId, businessId },
    orderBy: { createdAt: "asc" },
  });
}

export function isCancelStatus(s: string): s is CancelRequestStatus {
  return (Object.values(CancelRequestStatus) as string[]).includes(s);
}

export function isRefundStatus(s: string): s is RefundRequestStatus {
  return (Object.values(RefundRequestStatus) as string[]).includes(s);
}

export function isRefundMethod(s: string): s is RefundMethodWire {
  return parseRefundMethod(s) != null;
}
