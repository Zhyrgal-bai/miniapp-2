import { MembershipRole } from "@prisma/client";
import { prisma } from "./db.js";

/** Платформа Mini App: только магазины, где пользователь — OWNER (в схеме нет `ownerId`, связь через Membership). */
export type PlatformMyBusinessDTO = {
  id: number;
  name: string;
  isActive: boolean;
};

export async function listPlatformOwnerBusinesses(
  telegramId: string,
): Promise<PlatformMyBusinessDTO[]> {
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true },
  });
  if (!user) {
    return [];
  }

  return prisma.business.findMany({
    where: {
      memberships: {
        some: {
          userId: user.id,
          role: MembershipRole.OWNER,
        },
      },
    },
    select: {
      id: true,
      name: true,
      isActive: true,
    },
    orderBy: { id: "asc" },
  });
}
