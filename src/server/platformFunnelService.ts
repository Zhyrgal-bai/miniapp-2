import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";

const ALLOWED_STEPS = new Set([
  "platform_view",
  "onboarding_step_1",
  "onboarding_step_2",
  "onboarding_step_3",
  "onboarding_complete",
  "register_start",
  "register_submit",
  "store_open",
  "settings_open",
  "admin_open",
  "checkout_start",
  "checkout_complete",
  "support_open",
  "first_product_added",
  "storefront_published",
]);

export type FunnelEventInput = {
  step: string;
  telegramId?: string | null;
  businessId?: number | null;
  meta?: Record<string, unknown>;
};

export async function ingestPlatformFunnelEvents(
  events: FunnelEventInput[],
): Promise<number> {
  const rows: Prisma.PlatformFunnelEventCreateManyInput[] = [];
  for (const ev of events.slice(0, 16)) {
    const step = String(ev.step ?? "").trim().toLowerCase();
    if (!ALLOWED_STEPS.has(step)) continue;
    const tid = ev.telegramId?.trim().slice(0, 32) ?? null;
    const bid =
      ev.businessId != null &&
      Number.isInteger(ev.businessId) &&
      ev.businessId > 0
        ? ev.businessId
        : null;
    rows.push({
      step,
      telegramId: tid,
      businessId: bid,
      meta: (ev.meta ?? {}) as Prisma.InputJsonValue,
    });
  }
  if (rows.length === 0) return 0;
  const r = await prisma.platformFunnelEvent.createMany({ data: rows });
  return r.count;
}

export async function funnelSummarySince(since: Date): Promise<
  Array<{ step: string; count: number }>
> {
  const rows = await prisma.platformFunnelEvent.groupBy({
    by: ["step"],
    where: { createdAt: { gte: since } },
    _count: { step: true },
  });
  return rows
    .map((r) => ({ step: r.step, count: r._count.step }))
    .sort((a, b) => b.count - a.count);
}
