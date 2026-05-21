import { BusinessStaffRole, Prisma } from "@prisma/client";
import { prisma } from "./db.js";

export type BusinessStaffRecord = {
  id: number;
  businessId: number;
  userId: number;
  role: BusinessStaffRole;
  permissions: string[];
};

export async function findBusinessStaff(
  businessId: number,
  userId: number,
): Promise<BusinessStaffRecord | null> {
  const row = await prisma.businessStaff.findUnique({
    where: { userId_businessId: { userId, businessId } },
    select: {
      id: true,
      businessId: true,
      userId: true,
      role: true,
      permissions: true,
    },
  });
  return row;
}

export async function findBusinessStaffByTelegramId(
  businessId: number,
  telegramId: string,
): Promise<BusinessStaffRecord | null> {
  const user = await prisma.user.findUnique({
    where: { telegramId: String(telegramId).trim() },
    select: { id: true },
  });
  if (!user) return null;
  const { resolveBusinessStaffRecord } = await import("./businessStaffBackfill.js");
  return resolveBusinessStaffRecord(businessId, user.id);
}

export async function listBusinessStaffForUser(
  userId: number,
): Promise<Array<{ businessId: number; role: BusinessStaffRole }>> {
  const rows = await prisma.businessStaff.findMany({
    where: { userId },
    select: { businessId: true, role: true },
    orderBy: { businessId: "asc" },
  });
  return rows;
}

export function isMerchantStaffRole(role: BusinessStaffRole): boolean {
  return (
    role === BusinessStaffRole.OWNER ||
    role === BusinessStaffRole.ADMIN ||
    role === BusinessStaffRole.MANAGER ||
    role === BusinessStaffRole.SUPPORT
  );
}

export async function createOwnerStaffRow(
  tx: Prisma.TransactionClient,
  input: { businessId: number; userId: number },
): Promise<void> {
  await tx.businessStaff.upsert({
    where: {
      userId_businessId: { userId: input.userId, businessId: input.businessId },
    },
    create: {
      businessId: input.businessId,
      userId: input.userId,
      role: BusinessStaffRole.OWNER,
      permissions: [],
    },
    update: { role: BusinessStaffRole.OWNER },
  });
}
