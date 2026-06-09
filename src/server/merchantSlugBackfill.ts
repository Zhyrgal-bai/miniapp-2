/**
 * One-time data backfill: replace legacy technical Business.slug values with
 * human slugs derived from store names (Phase 17.3). Idempotent and safe to re-run.
 */

import {
  allocateUniqueBusinessSlugExcluding,
  isLegacyTechnicalSlug,
  slugifyStoreName,
} from "../shared/storeSlug.js";
import { prisma } from "./db.js";
import { invalidateStorefrontCache } from "./storefrontCache.js";

export type SlugBackfillStatus =
  | "updated"
  | "dry_run"
  | "skipped_no_name_slug"
  | "skipped_no_unique_slug"
  | "skipped_already_human";

export type SlugBackfillReportEntry = {
  id: number;
  from: string | null;
  to: string | null;
  status: SlugBackfillStatus;
};

export type SlugBackfillResult = {
  dryRun: boolean;
  entries: SlugBackfillReportEntry[];
};

async function applySlugChange(input: {
  businessId: number;
  nextSlug: string;
  previousSlug: string | null;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const txDb = tx as any;

    if (input.previousSlug != null && input.previousSlug.trim() !== "") {
      const prevLower = input.previousSlug.trim().toLowerCase();
      if (prevLower !== input.nextSlug) {
        await txDb.storefrontSlugAlias.upsert({
          where: { oldSlug: prevLower },
          create: { oldSlug: prevLower, businessId: input.businessId },
          update: { businessId: input.businessId },
        });
      }
    }

    await txDb.storefrontSlugAlias.deleteMany({
      where: { oldSlug: input.nextSlug, businessId: input.businessId },
    });

    await tx.business.update({
      where: { id: input.businessId },
      data: { slug: input.nextSlug } as any,
    });
  });

  invalidateStorefrontCache(input.businessId);
}

export async function backfillLegacyBusinessSlugs(input: {
  dryRun: boolean;
}): Promise<SlugBackfillResult> {
  const businesses = await prisma.business.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { id: "asc" },
  });

  const entries: SlugBackfillReportEntry[] = [];

  for (const business of businesses) {
    const from = business.slug ?? null;

    if (!isLegacyTechnicalSlug(from)) {
      entries.push({
        id: business.id,
        from,
        to: from,
        status: "skipped_already_human",
      });
      continue;
    }

    const base = slugifyStoreName(business.name);
    if (base === "") {
      entries.push({
        id: business.id,
        from,
        to: null,
        status: "skipped_no_name_slug",
      });
      continue;
    }

    const nextSlug = await prisma.$transaction((tx) =>
      allocateUniqueBusinessSlugExcluding(tx, business.name, business.id),
    );

    if (nextSlug == null) {
      entries.push({
        id: business.id,
        from,
        to: null,
        status: "skipped_no_unique_slug",
      });
      continue;
    }

    if ((from ?? "").toLowerCase() === nextSlug.toLowerCase()) {
      entries.push({
        id: business.id,
        from,
        to: nextSlug,
        status: "skipped_already_human",
      });
      continue;
    }

    if (input.dryRun) {
      entries.push({
        id: business.id,
        from,
        to: nextSlug,
        status: "dry_run",
      });
      continue;
    }

    await applySlugChange({
      businessId: business.id,
      nextSlug,
      previousSlug: from,
    });

    entries.push({
      id: business.id,
      from,
      to: nextSlug,
      status: "updated",
    });
  }

  return { dryRun: input.dryRun, entries };
}
