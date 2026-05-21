import { BusinessStaffRole } from "@prisma/client";
import { prisma } from "./db.js";
import { isPlatformAdminTelegramId } from "./platformAdminService.js";

/** Staff магазина (не покупатель). Без bypass для platform-admin. */
export async function platformMerchantOwnsBusiness(
  telegramId: string,
  businessId: number,
): Promise<boolean> {
  if (!Number.isInteger(businessId) || businessId <= 0) return false;
  const tid = telegramId.trim();
  if (!/^\d+$/.test(tid)) return false;

  const m = await prisma.businessStaff.findFirst({
    where: {
      businessId,
      user: { telegramId: tid },
    },
    select: { id: true },
  });
  return m != null;
}

/** Настройки магазина: staff магазина или суперадмин платформы. */
export async function platformMerchantCanAccessStoreSettings(
  telegramId: string,
  businessId: number,
): Promise<boolean> {
  if (await platformMerchantOwnsBusiness(telegramId, businessId)) return true;
  return isPlatformAdminTelegramId(telegramId);
}

export async function platformMerchantIsStoreOwner(
  telegramId: string,
  businessId: number,
): Promise<boolean> {
  const tid = telegramId.trim();
  if (!/^\d+$/.test(tid)) return false;
  const row = await prisma.businessStaff.findFirst({
    where: {
      businessId,
      role: BusinessStaffRole.OWNER,
      user: { telegramId: tid },
    },
    select: { id: true },
  });
  return row != null;
}
