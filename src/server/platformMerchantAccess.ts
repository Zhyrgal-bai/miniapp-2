import { MembershipRole } from "@prisma/client";
import { prisma } from "./db.js";

/** Владелец или админ магазина (как в connect-bot). Без bypass для platform-admin. */
export async function platformMerchantOwnsBusiness(
  telegramId: string,
  businessId: number,
): Promise<boolean> {
  if (!Number.isInteger(businessId) || businessId <= 0) return false;
  const tid = telegramId.trim();
  if (!/^\d+$/.test(tid)) return false;

  const m = await prisma.membership.findFirst({
    where: {
      businessId,
      role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN] },
      user: { telegramId: tid },
    },
    select: { id: true },
  });
  return m != null;
}
