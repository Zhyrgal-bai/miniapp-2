import type {
  Prisma,
  RefundAuditActorType,
  RefundMethod,
  RefundRequestStatus,
} from "@prisma/client";

type AuditTx = Prisma.TransactionClient;

export async function appendRefundAuditLog(
  tx: AuditTx,
  input: {
    refundRequestId: number;
    businessId: number;
    orderId: number;
    actorType: RefundAuditActorType;
    actorUserId?: number | null;
    fromStatus: RefundRequestStatus | null;
    toStatus: RefundRequestStatus;
    refundAmount?: number | null;
    refundMethod?: RefundMethod | null;
    paymentReference?: string | null;
    merchantNote?: string | null;
  },
): Promise<void> {
  await tx.refundAuditLog.create({
    data: {
      refundRequestId: input.refundRequestId,
      businessId: input.businessId,
      orderId: input.orderId,
      actorType: input.actorType,
      actorUserId: input.actorUserId ?? null,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      refundAmount: input.refundAmount ?? null,
      refundMethod: input.refundMethod ?? null,
      paymentReference: input.paymentReference?.trim().slice(0, 256) || null,
      merchantNote: input.merchantNote?.trim().slice(0, 2000) || null,
    },
  });
}
