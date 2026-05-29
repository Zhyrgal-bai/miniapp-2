import { BusinessStaffRole } from "@prisma/client";
import { prisma } from "./db.js";

/** Owner telegram id for reservation approval notifications. */
export async function findBusinessOwnerTelegramId(
  businessId: number,
): Promise<string | null> {
  const owner = await prisma.businessStaff.findFirst({
    where: { businessId, role: BusinessStaffRole.OWNER },
    include: { user: true },
    orderBy: { id: "asc" },
  });
  const tid = owner?.user?.telegramId;
  return typeof tid === "string" && /^\d+$/.test(tid.trim()) ? tid.trim() : null;
}

export async function canApproveTableReservation(
  businessId: number,
  callerTelegramId: number,
): Promise<boolean> {
  const ownerTg = await findBusinessOwnerTelegramId(businessId);
  if (ownerTg && String(callerTelegramId) === ownerTg) return true;

  const user = await prisma.user.findUnique({
    where: { telegramId: String(callerTelegramId) },
    select: { id: true },
  });
  if (!user) return false;

  const staff = await prisma.businessStaff.findFirst({
    where: {
      businessId,
      userId: user.id,
      role: { in: [BusinessStaffRole.OWNER, BusinessStaffRole.ADMIN] },
    },
    select: { id: true },
  });
  return staff != null;
}
