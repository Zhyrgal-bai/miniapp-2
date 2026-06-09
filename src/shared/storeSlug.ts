import type { Prisma } from "@prisma/client";

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function transliterateToLatin(input: string): string {
  let out = "";
  for (const ch of input) {
    const lower = ch.toLowerCase();
    if (CYRILLIC_TO_LATIN[lower] != null) {
      out += CYRILLIC_TO_LATIN[lower];
      continue;
    }
    out += lower;
  }
  return out;
}

/** «CupCoffee» → `cupcoffee`, «Nur Market» → `nur-market`, «БARS» → `bars`. */
export function slugifyStoreName(raw: string): string {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (trimmed === "") return "";

  let s = transliterateToLatin(trimmed);
  s = s.replace(/[^a-z0-9\s-]/g, "");
  s = s.replace(/\s+/g, "-");
  s = s.replace(/-+/g, "-").replace(/^-+|-+$/g, "");

  if (s.length > 80) {
    s = s.slice(0, 80).replace(/-+$/, "");
  }
  return s.length >= 2 ? s : "";
}

/** Reserved slugs that must never be assigned to a store (route collisions). */
export const RESERVED_STORE_SLUGS = new Set<string>([
  "s",
  "store",
  "merchant",
  "platform",
  "admin",
  "api",
  "about",
  "faq",
  "cart",
  "checkout",
  "support",
]);

export type MerchantSlugValidation =
  | { ok: true; slug: string }
  | { ok: false; error: "TOO_SHORT" | "INVALID_CHARS" | "RESERVED" };

/**
 * Validate + normalize a merchant-requested slug (Phase 17.3).
 * Pure: does not check DB uniqueness (caller does that).
 */
export function validateMerchantSlug(raw: string): MerchantSlugValidation {
  const lowered = String(raw ?? "").trim().toLowerCase();
  if (lowered === "") {
    return { ok: false, error: "TOO_SHORT" };
  }
  // Reject anything outside latin alphanumerics, spaces and hyphens (e.g.
  // cyrillic or symbols) — merchants type latin slugs directly, no transliteration.
  if (/[^a-z0-9\s-]/.test(lowered)) {
    return { ok: false, error: "INVALID_CHARS" };
  }
  const normalized = lowered
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (normalized.length < 2 || normalized.length > 80) {
    return { ok: false, error: "TOO_SHORT" };
  }
  if (RESERVED_STORE_SLUGS.has(normalized)) {
    return { ok: false, error: "RESERVED" };
  }
  return { ok: true, slug: normalized };
}

async function isBusinessSlugTaken(
  tx: Prisma.TransactionClient,
  slug: string,
): Promise<boolean> {
  const row = await tx.business.findFirst({
    where: { slug: { equals: slug, mode: "insensitive" } } as any,
    select: { id: true },
  });
  return row != null;
}

/** Base36 timestamp suffix from `Date.now().toString(36)` collision fallback. */
function isBase36TimestampSuffix(suffix: string): boolean {
  if (!/^[a-z0-9]+$/.test(suffix)) return false;
  if (suffix.length < 6) return false;
  return /[a-z]/.test(suffix) && /[0-9]/.test(suffix);
}

/**
 * True when slug is null/empty or an auto-generated technical fallback
 * (`shop-<base36ts>`, `shop-<id>-<base36ts>`, or `*-<base36ts>`).
 */
export function isLegacyTechnicalSlug(slug: string | null | undefined): boolean {
  const s = (slug ?? "").trim().toLowerCase();
  if (s === "") return true;
  if (s.startsWith("shop-")) return true;

  const lastDash = s.lastIndexOf("-");
  if (lastDash <= 0) return false;
  const suffix = s.slice(lastDash + 1);
  if (/^\d+$/.test(suffix)) return false;
  return isBase36TimestampSuffix(suffix);
}

async function isSlugReservedByOther(
  tx: Prisma.TransactionClient,
  slug: string,
  excludeBusinessId: number,
): Promise<boolean> {
  const normalized = slug.trim().toLowerCase();
  const row = await tx.business.findFirst({
    where: { slug: { equals: normalized, mode: "insensitive" } } as any,
    select: { id: true },
  });
  if (row != null && row.id !== excludeBusinessId) return true;

  const alias = await (tx as any).storefrontSlugAlias.findUnique({
    where: { oldSlug: normalized },
    select: { businessId: true },
  });
  return alias != null && alias.businessId !== excludeBusinessId;
}

/**
 * Like `allocateUniqueBusinessSlug`, but excludes `excludeBusinessId` from
 * collision checks and also treats `StorefrontSlugAlias` as reserved.
 * Returns null when the name cannot yield a slug or uniqueness is exhausted.
 */
export async function allocateUniqueBusinessSlugExcluding(
  tx: Prisma.TransactionClient,
  storeName: string,
  excludeBusinessId: number,
): Promise<string | null> {
  const base = slugifyStoreName(storeName);
  if (base === "") return null;

  const tryCandidate = async (candidate: string): Promise<boolean> => {
    if (RESERVED_STORE_SLUGS.has(candidate)) return false;
    return !(await isSlugReservedByOther(tx, candidate, excludeBusinessId));
  };

  if (await tryCandidate(base)) return base;

  for (let n = 2; n <= 100; n += 1) {
    const candidate = `${base}-${n}`;
    if (await tryCandidate(candidate)) return candidate;
  }

  return null;
}

function technicalFallbackSlug(): string {
  return `shop-${Date.now().toString(36)}`;
}

/**
 * Уникальный slug для Business.slug при создании магазина.
 * Коллизии: `bars`, `bars-2`, `bars-3`, …
 */
export async function allocateUniqueBusinessSlug(
  tx: Prisma.TransactionClient,
  storeName: string,
): Promise<string> {
  const base = slugifyStoreName(storeName);
  if (base === "") return technicalFallbackSlug();

  if (!(await isBusinessSlugTaken(tx, base))) return base;

  for (let n = 2; n <= 100; n += 1) {
    const candidate = `${base}-${n}`;
    if (!(await isBusinessSlugTaken(tx, candidate))) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`;
}
