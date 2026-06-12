import type { PrismaClient } from "@prisma/client";
import { safeDeleteCloudinaryAsset } from "./delete.js";
import { logMediaAudit } from "./mediaAuditService.js";

const MAX_ATTEMPTS = 8;
const BASE_DELAY_MS = 60_000;

function backoffMs(attempts: number): number {
  const exp = Math.min(attempts, 6);
  return BASE_DELAY_MS * 2 ** exp;
}

export async function enqueueMediaDestroy(
  prisma: PrismaClient,
  input: { businessId: number; publicId: string; reason: string },
): Promise<void> {
  const publicId = input.publicId.trim();
  if (!publicId) return;

  try {
    const existing = await prisma.mediaDestroyJob.findFirst({
      where: {
        businessId: input.businessId,
        publicId,
        status: "PENDING",
      },
    });
    if (existing) return;

    await prisma.mediaDestroyJob.create({
      data: {
        businessId: input.businessId,
        publicId,
        reason: input.reason.slice(0, 512),
        status: "PENDING",
        nextRetryAt: new Date(),
      },
    });
  } catch (e) {
    console.error("[enqueueMediaDestroy]", e);
  }
}

export async function processMediaDestroyQueue(
  prisma: PrismaClient,
): Promise<{ processed: number; done: number; failed: number }> {
  const now = new Date();
  const jobs = await prisma.mediaDestroyJob.findMany({
    where: {
      status: "PENDING",
      nextRetryAt: { lte: now },
    },
    orderBy: { nextRetryAt: "asc" },
    take: 50,
  });

  let done = 0;
  let failed = 0;

  for (const job of jobs) {
    const result = await safeDeleteCloudinaryAsset({
      businessId: job.businessId,
      publicId: job.publicId,
      ...(job.publicId.startsWith("telegram-miniapp/receipts/")
        ? { allowGlobalReceiptPaths: true }
        : {}),
    });

    if (result.ok) {
      await prisma.mediaDestroyJob.update({
        where: { id: job.id },
        data: { status: "DONE", lastError: null },
      });
      await logMediaAudit(prisma, {
        businessId: job.businessId,
        event: "RETRY",
        publicId: job.publicId,
        actor: { actorType: "system" },
        details: { jobId: job.id, reason: job.reason, success: true },
      });
      done += 1;
    } else {
      const attempts = job.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await prisma.mediaDestroyJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            attempts,
            lastError: result.error,
          },
        });
        console.error(
          `[mediaDestroyQueue] FAILED after ${attempts} attempts:`,
          job.publicId,
          result.error,
        );
        failed += 1;
      } else {
        await prisma.mediaDestroyJob.update({
          where: { id: job.id },
          data: {
            attempts,
            lastError: result.error,
            nextRetryAt: new Date(Date.now() + backoffMs(attempts)),
          },
        });
        await logMediaAudit(prisma, {
          businessId: job.businessId,
          event: "RETRY",
          publicId: job.publicId,
          actor: { actorType: "system" },
          details: {
            jobId: job.id,
            attempts,
            error: result.error,
          },
        });
      }
    }
  }

  return { processed: jobs.length, done, failed };
}
