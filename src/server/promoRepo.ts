import type { PrismaClient } from "@prisma/client";

export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase();
}

export type PromoRow = {
  code: string;
  discount: number;
  maxUses: number;
  used: number;
};

export async function listPromosFromDb(client: PrismaClient): Promise<PromoRow[]> {
  const rows = await client.promo.findMany({ orderBy: { id: "desc" } });
  return rows.map((r) => ({
    code: r.code,
    discount: r.discount,
    maxUses: r.maxUses,
    used: r.used,
  }));
}

export async function tryApplyPromoDb(
  client: PrismaClient,
  code: string,
  total: number
): Promise<{ newTotal: number; discount: number }> {
  const c = normalizePromoCode(code);
  if (!c) throw new Error("EMPTY");
  if (!Number.isFinite(total) || total < 0) throw new Error("BAD_TOTAL");
  const p = await client.promo.findUnique({ where: { code: c } });
  if (!p) throw new Error("NOT_FOUND");
  if (p.used >= p.maxUses) throw new Error("EXHAUSTED");
  const discountAmount = total * (p.discount / 100);
  const newTotal = total - discountAmount;
  return { newTotal: Math.round(newTotal), discount: p.discount };
}

export async function consumePromoDb(
  client: PrismaClient,
  code: string
): Promise<void> {
  const c = normalizePromoCode(code);
  if (!c) throw new Error("EMPTY");
  await client.$transaction(async (tx) => {
    const p = await tx.promo.findUnique({ where: { code: c } });
    if (!p) throw new Error("NOT_FOUND");
    if (p.used >= p.maxUses) throw new Error("EXHAUSTED");
    await tx.promo.update({
      where: { code: c },
      data: { used: { increment: 1 } },
    });
  });
}

export async function createPromoDb(
  client: PrismaClient,
  code: string,
  discount: number,
  maxUses: number
): Promise<PromoRow> {
  const c = normalizePromoCode(code);
  if (!c) throw new Error("EMPTY_CODE");
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    throw new Error("BAD_DISCOUNT");
  }
  if (
    !Number.isFinite(maxUses) ||
    maxUses < 1 ||
    !Number.isInteger(maxUses)
  ) {
    throw new Error("BAD_MAX_USES");
  }
  const row = await client.promo.create({
    data: { code: c, discount: Math.round(discount), maxUses, used: 0 },
  });
  return {
    code: row.code,
    discount: row.discount,
    maxUses: row.maxUses,
    used: row.used,
  };
}

export async function deletePromoByCodeDb(
  client: PrismaClient,
  code: string
): Promise<boolean> {
  const c = normalizePromoCode(code);
  if (!c) return false;
  try {
    await client.promo.delete({ where: { code: c } });
    return true;
  } catch {
    return false;
  }
}
