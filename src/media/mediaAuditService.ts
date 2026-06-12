import type { MediaAuditEvent, Prisma } from "@prisma/client";

type AuditTx = Prisma.TransactionClient;

export type MediaAuditActor = {
  actorType: "merchant" | "operator" | "system";
  actorUserId?: number | null;
};

export async function appendMediaAuditLog(
  tx: AuditTx,
  input: {
    businessId: number;
    event: MediaAuditEvent;
    publicId?: string | null;
    productId?: number | null;
    actor: MediaAuditActor;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  await tx.mediaAuditLog.create({
    data: {
      businessId: input.businessId,
      event: input.event,
      publicId: input.publicId?.trim().slice(0, 512) || null,
      productId: input.productId ?? null,
      actorType: input.actor.actorType,
      actorUserId: input.actor.actorUserId ?? null,
      details: (input.details ?? {}) as Prisma.InputJsonValue,
    },
  });
}

/** Fire-and-forget audit outside transactions. */
export async function logMediaAudit(
  prisma: { mediaAuditLog: AuditTx["mediaAuditLog"] },
  input: Parameters<typeof appendMediaAuditLog>[1],
): Promise<void> {
  try {
    await appendMediaAuditLog(prisma as AuditTx, input);
  } catch (e) {
    console.error("[mediaAudit]", e);
  }
}
