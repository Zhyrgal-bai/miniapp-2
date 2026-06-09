/**
 * Merchant slug service (Phase 17.3).
 *
 * Lets a merchant change their storefront slug with normalization, uniqueness,
 * collision feedback, and SEO-safe alias history (old slug stays resolvable).
 * Never auto-regenerates slugs on rename. Tenant-scoped.
 */

import { prisma } from "./db.js";
import { validateMerchantSlug } from "../shared/storeSlug.js";

const db = prisma as any;

export type SlugAvailability = {
  ok: boolean;
  slug: string | null;
  reason: "AVAILABLE" | "TAKEN" | "RESERVED" | "INVALID_CHARS" | "TOO_SHORT" | "CURRENT";
};

async function slugOwner(slug: string): Promise<number | null> {
  const row = await prisma.business.findFirst({
    where: { slug: { equals: slug, mode: "insensitive" } } as any,
    select: { id: true },
  });
  return row?.id ?? null;
}

async function aliasOwner(slug: string): Promise<number | null> {
  const row = await db.storefrontSlugAlias.findUnique({
    where: { oldSlug: slug },
    select: { businessId: true },
  });
  return row?.businessId ?? null;
}

export async function checkSlugAvailability(input: {
  businessId: number;
  slug: string;
}): Promise<SlugAvailability> {
  const validation = validateMerchantSlug(input.slug);
  if (!validation.ok) {
    return { ok: false, slug: null, reason: validation.error };
  }
  const slug = validation.slug;

  const current = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: { slug: true },
  });
  if ((current?.slug ?? "").toLowerCase() === slug) {
    return { ok: false, slug, reason: "CURRENT" };
  }

  const owner = await slugOwner(slug);
  if (owner != null && owner !== input.businessId) {
    return { ok: false, slug, reason: "TAKEN" };
  }
  // An alias pointing to another business also blocks reuse.
  const aliasBusiness = await aliasOwner(slug);
  if (aliasBusiness != null && aliasBusiness !== input.businessId) {
    return { ok: false, slug, reason: "TAKEN" };
  }
  return { ok: true, slug, reason: "AVAILABLE" };
}

export type SlugChangeResult =
  | { ok: true; slug: string; previousSlug: string | null }
  | { ok: false; error: SlugAvailability["reason"] };

export async function changeMerchantSlug(input: {
  businessId: number;
  slug: string;
}): Promise<SlugChangeResult> {
  const availability = await checkSlugAvailability(input);
  if (!availability.ok || availability.slug == null) {
    return { ok: false, error: availability.reason };
  }
  const nextSlug = availability.slug;

  return prisma.$transaction(async (tx) => {
    const txDb = tx as any;
    const current = await tx.business.findUnique({
      where: { id: input.businessId },
      select: { slug: true },
    });
    const previousSlug = current?.slug ?? null;

    // Persist the old slug as a resolvable alias (SEO-safe redirect).
    if (previousSlug != null && previousSlug.trim() !== "") {
      const prevLower = previousSlug.trim().toLowerCase();
      if (prevLower !== nextSlug) {
        await txDb.storefrontSlugAlias.upsert({
          where: { oldSlug: prevLower },
          create: { oldSlug: prevLower, businessId: input.businessId },
          update: { businessId: input.businessId },
        });
      }
    }

    // If the new slug was previously an alias of THIS business, free it.
    await txDb.storefrontSlugAlias.deleteMany({
      where: { oldSlug: nextSlug, businessId: input.businessId },
    });

    await tx.business.update({
      where: { id: input.businessId },
      data: { slug: nextSlug } as any,
    });

    return { ok: true, slug: nextSlug, previousSlug };
  });
}

/** Resolve a slug (current or historical alias) to a businessId. */
export async function resolveSlugOrAlias(slug: string): Promise<number | null> {
  const direct = await slugOwner(slug);
  if (direct != null) return direct;
  return aliasOwner(slug);
}
