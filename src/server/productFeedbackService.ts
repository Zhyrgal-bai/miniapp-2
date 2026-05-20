import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";

const ALLOWED_KINDS = new Set(["bug", "feature", "ux", "other"]);

export async function createProductFeedback(input: {
  kind: string;
  message: string;
  telegramId?: string | null;
  businessId?: number | null;
  page?: string | null;
  meta?: Record<string, unknown>;
}): Promise<{ id: number }> {
  const kind = ALLOWED_KINDS.has(input.kind) ? input.kind : "other";
  const message = String(input.message ?? "").trim().slice(0, 4000);
  if (message.length < 4) {
    throw new Error("MESSAGE_TOO_SHORT");
  }
  const row = await prisma.productFeedback.create({
    data: {
      kind,
      message,
      telegramId: input.telegramId?.trim().slice(0, 32) ?? null,
      businessId:
        input.businessId != null &&
        Number.isInteger(input.businessId) &&
        input.businessId > 0
          ? input.businessId
          : null,
      page: input.page?.trim().slice(0, 128) ?? null,
      meta: (input.meta ?? {}) as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  return row;
}

export async function listProductFeedback(input: {
  status?: string;
  limit?: number;
}): Promise<
  Array<{
    id: number;
    kind: string;
    message: string;
    telegramId: string | null;
    businessId: number | null;
    page: string | null;
    status: string;
    createdAt: string;
  }>
> {
  const take = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const where =
    input.status != null && input.status.trim() !== ""
      ? { status: input.status.trim() }
      : {};
  const rows = await prisma.productFeedback.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    message: r.message,
    telegramId: r.telegramId,
    businessId: r.businessId,
    page: r.page,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));
}
