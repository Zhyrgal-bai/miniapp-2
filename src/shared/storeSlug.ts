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
