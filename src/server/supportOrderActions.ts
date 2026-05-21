import {
  CancelRequestStatus,
  RefundRequestStatus,
  SupportSenderType,
  SupportTicketStatus,
} from "@prisma/client";
import { orderCommercePhase, orderIsPaid } from "../shared/orderCommerce.js";
import { prisma } from "./db.js";
import { createMerchantNotification } from "./merchantNotificationsService.js";
import { orderDisplayLabel } from "../shared/orderDisplay.js";

const PRE_DELIVERY_PAID = new Set(["CONFIRMED", "SHIPPED"]);

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
  userId: number
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

  void createMerchantNotification({
    businessId: opts.businessId,
    kind: "SUPPORT_TICKET",
    title: "Заявка на отмену заказа",
    body: orderDisplayLabel(order),
    href: "/admin/support",
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
  const st = String(order.status).toUpperCase();
  if (!PRE_DELIVERY_PAID.has(st)) {
    return {
      ok: false,
      statusCode: 400,
      error: "Возврат денег доступен после оплаты и до доставки",
    };
  }

  const pending = await prisma.refundRequest.findFirst({
    where: {
      businessId: opts.businessId,
      orderId: opts.orderId,
      userId: opts.userId,
      status: {
        in: [
          RefundRequestStatus.REQUESTED,
          RefundRequestStatus.REVIEWING,
          RefundRequestStatus.APPROVED,
        ],
      },
    },
  });
  if (pending) {
    return {
      ok: false,
      statusCode: 400,
      error: "Заявка на возврат денег уже в работе",
    };
  }

  const row = await prisma.refundRequest.create({
    data: {
      businessId: opts.businessId,
      orderId: opts.orderId,
      userId: opts.userId,
      reason: opts.reason?.trim().slice(0, 200) || null,
      comment: opts.comment?.trim().slice(0, 2000) || null,
      status: RefundRequestStatus.REQUESTED,
    },
  });

  await appendSupportSystemMessage({
    businessId: opts.businessId,
    orderId: opts.orderId,
    userId: opts.userId,
    text: `Заявка на возврат денег по заказу ${orderDisplayLabel(order)}${opts.comment?.trim() ? `.\n\n${opts.comment.trim()}` : "."}`,
  });

  void createMerchantNotification({
    businessId: opts.businessId,
    kind: "SUPPORT_TICKET",
    title: "Заявка на возврат денег",
    body: orderDisplayLabel(order),
    href: "/admin/support",
  });

  return { ok: true, row };
}

function allowedCancelTransition(
  from: CancelRequestStatus,
  to: CancelRequestStatus
): boolean {
  if (from === to) return true;
  return from === CancelRequestStatus.PENDING && (to === CancelRequestStatus.APPROVED || to === CancelRequestStatus.REJECTED);
}

function allowedRefundTransition(
  from: RefundRequestStatus,
  to: RefundRequestStatus
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
      existing.userId
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
}): Promise<{ ok: true; row: unknown } | { ok: false; statusCode: number; error: string }> {
  const existing = await prisma.refundRequest.findFirst({
    where: { id: opts.refundId, businessId: opts.businessId },
    include: { order: true },
  });
  if (!existing) {
    return { ok: false, statusCode: 404, error: "Не найдено" };
  }
  if (!allowedRefundTransition(existing.status, opts.status)) {
    return { ok: false, statusCode: 400, error: "Неверный переход статуса" };
  }

  let refundAmount: number | null | undefined = undefined;
  if (opts.refundAmount !== undefined) {
    if (opts.refundAmount === null) refundAmount = null;
    else if (
      Number.isFinite(opts.refundAmount) &&
      opts.refundAmount >= 0 &&
      Number.isInteger(opts.refundAmount)
    ) {
      refundAmount = opts.refundAmount;
    } else {
      return { ok: false, statusCode: 400, error: "Неверная сумма возврата" };
    }
  }

  const row = await prisma.$transaction(async (tx) => {
    const updateData: {
      status: RefundRequestStatus;
      merchantComment?: string | null;
      refundAmount?: number | null;
    } = { status: opts.status };
    if (opts.merchantComment !== undefined) {
      updateData.merchantComment =
        opts.merchantComment?.trim().slice(0, 2000) || null;
    }
    if (refundAmount !== undefined) {
      updateData.refundAmount = refundAmount;
    }
    const updated = await tx.refundRequest.update({
      where: { id: existing.id },
      data: updateData,
    });

    if (opts.status === RefundRequestStatus.REFUNDED) {
      await tx.order.update({
        where: { id: existing.orderId },
        data: { status: "CANCELLED", paymentId: null },
      });
    }

    return updated;
  });

  if (opts.status === RefundRequestStatus.REFUNDED) {
    await archiveSupportThreads(
      existing.businessId,
      existing.orderId,
      existing.userId
    );
    const { onOrderCancelled } = await import("./orderInventoryHooks.js");
    await onOrderCancelled(existing.orderId, existing.order.status);
  }

  const statusMsg: Partial<Record<RefundRequestStatus, string>> = {
      REVIEWING: "Заявка на возврат денег принята на проверку.",
      APPROVED: "Возврат денег одобрен. Ожидайте зачисления.",
      REJECTED: "Заявка на возврат денег отклонена.",
      REFUNDED: `Возврат ${refundAmount ?? existing.refundAmount ?? existing.order.total} сом выполнен.`,
  };
  const base = statusMsg[opts.status];
  if (base) {
    await appendSupportSystemMessage({
      businessId: existing.businessId,
      orderId: existing.orderId,
      userId: existing.userId,
      text: opts.merchantComment?.trim()
        ? `${base}\n\n${opts.merchantComment.trim()}`
        : base,
    });
  }

  return { ok: true, row };
}

export function isCancelStatus(s: string): s is CancelRequestStatus {
  return (Object.values(CancelRequestStatus) as string[]).includes(s);
}

export function isRefundStatus(s: string): s is RefundRequestStatus {
  return (Object.values(RefundRequestStatus) as string[]).includes(s);
}
