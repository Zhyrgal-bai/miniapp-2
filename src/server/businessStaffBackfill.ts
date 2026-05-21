import {
  BusinessStaffRole,
  MembershipRole,
  RegistrationStatus,
} from "@prisma/client";
import {
  createOwnerStaffRow,
  type BusinessStaffRecord,
  findBusinessStaff,
} from "./businessStaffAccess.js";
import { prisma } from "./db.js";
import { logVerbose } from "./serverDebug.js";

function membershipRoleToStaffRole(
  role: MembershipRole,
  permissions: string[],
): BusinessStaffRole {
  if (role === MembershipRole.OWNER) return BusinessStaffRole.OWNER;
  if (role === MembershipRole.ADMIN) return BusinessStaffRole.ADMIN;
  if (permissions.length > 0) return BusinessStaffRole.ADMIN;
  return BusinessStaffRole.SUPPORT;
}

/** Resolve staff from BusinessStaff, with legacy Membership fallback. */
export async function resolveBusinessStaffRecord(
  businessId: number,
  userId: number,
): Promise<BusinessStaffRecord | null> {
  const direct = await findBusinessStaff(businessId, userId);
  if (direct) return direct;

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId, businessId } },
    select: { role: true, permissions: true },
  });
  if (!membership) return null;

  const perms = membership.permissions ?? [];
  const isLegacyStaff =
    membership.role === MembershipRole.OWNER ||
    membership.role === MembershipRole.ADMIN ||
    perms.length > 0;
  if (!isLegacyStaff) return null;

  const staffRole = membershipRoleToStaffRole(membership.role, perms);
  const healed = await prisma.businessStaff.upsert({
    where: { userId_businessId: { userId, businessId } },
    create: {
      businessId,
      userId,
      role: staffRole,
      permissions: perms,
    },
    update: {
      role: staffRole,
      permissions: perms,
    },
    select: {
      id: true,
      businessId: true,
      userId: true,
      role: true,
      permissions: true,
    },
  });
  return healed;
}

/**
 * One-time heal: copy legacy Membership staff into BusinessStaff.
 * Safe to run on every boot (idempotent upserts).
 */
export async function backfillBusinessStaffFromLegacy(): Promise<number> {
  let healed = 0;

  const legacyMemberships = await prisma.membership.findMany({
    where: {
      OR: [
        { role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN] } },
        { NOT: { permissions: { equals: [] } } },
      ],
    },
    select: {
      userId: true,
      businessId: true,
      role: true,
      permissions: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  for (const m of legacyMemberships) {
    const perms = m.permissions ?? [];
    const staffRole = membershipRoleToStaffRole(m.role, perms);
    await prisma.businessStaff.upsert({
      where: {
        userId_businessId: { userId: m.userId, businessId: m.businessId },
      },
      create: {
        businessId: m.businessId,
        userId: m.userId,
        role: staffRole,
        permissions: perms,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      },
      update: {
        role: staffRole,
        permissions: perms,
      },
    });
    healed++;
  }

  const businessesWithoutStaff = await prisma.business.findMany({
    where: { staff: { none: {} } },
    select: { id: true, name: true },
  });

  for (const business of businessesWithoutStaff) {
    const request = await prisma.registrationRequest.findFirst({
      where: {
        status: RegistrationStatus.APPROVED,
        name: { equals: business.name, mode: "insensitive" },
      },
      orderBy: { id: "desc" },
      select: { telegramId: true },
    });
    if (!request) {
      logVerbose(
        `[staff] No APPROVED registration match for business ${business.id} (${business.name})`,
      );
      continue;
    }

    const owner = await prisma.user.findUnique({
      where: { telegramId: request.telegramId },
      select: { id: true },
    });
    if (!owner) continue;

    await prisma.$transaction(async (tx) => {
      await createOwnerStaffRow(tx, {
        businessId: business.id,
        userId: owner.id,
      });
    });
    healed++;
    logVerbose(
      `[staff] Backfilled OWNER for business ${business.id} from registration request`,
    );
  }

  return healed;
}
