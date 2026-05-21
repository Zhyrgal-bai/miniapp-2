import { RegistrationStatus } from "@prisma/client";
import { prisma } from "./db.js";

export type MerchantRegistrationStatusPayload = {
  status: "none" | "pending" | "rejected" | "has_stores";
  requestId?: number;
  storeName?: string;
  businessType?: string;
  rejectReason?: string;
  createdAt?: string;
};

export async function getMerchantRegistrationStatus(
  telegramId: string,
): Promise<MerchantRegistrationStatusPayload> {
  const tid = telegramId.trim();
  if (!/^\d+$/.test(tid)) {
    return { status: "none" };
  }

  const user = await prisma.user.findUnique({
    where: { telegramId: tid },
    select: {
      staffAssignments: {
        select: { id: true },
        take: 1,
      },
      memberships: {
        where: { role: { in: ["OWNER", "ADMIN"] } },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (
    user &&
    (user.staffAssignments.length > 0 || user.memberships.length > 0)
  ) {
    return { status: "has_stores" };
  }

  const pending = await prisma.registrationRequest.findFirst({
    where: { telegramId: tid, status: RegistrationStatus.PENDING },
    orderBy: { id: "desc" },
    select: {
      id: true,
      name: true,
      businessType: true,
      createdAt: true,
    },
  });
  if (pending) {
    return {
      status: "pending",
      requestId: pending.id,
      storeName: pending.name,
      businessType: pending.businessType,
      createdAt: pending.createdAt.toISOString(),
    };
  }

  const rejected = await prisma.registrationRequest.findFirst({
    where: { telegramId: tid, status: RegistrationStatus.REJECTED },
    orderBy: { id: "desc" },
    select: {
      id: true,
      name: true,
      businessType: true,
      rejectReason: true,
      createdAt: true,
    },
  });
  if (rejected) {
    return {
      status: "rejected",
      requestId: rejected.id,
      storeName: rejected.name,
      businessType: rejected.businessType,
      ...(rejected.rejectReason != null && rejected.rejectReason !== ""
        ? { rejectReason: rejected.rejectReason }
        : {}),
      createdAt: rejected.createdAt.toISOString(),
    };
  }

  return { status: "none" };
}
