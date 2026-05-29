import type { WaitlistEntryStatus } from "@prisma/client";
import { prisma } from "./db.js";
import { publishVenueUpdate } from "./venueRealtime.js";
import {
  hasReservationConflict,
  syncDiningTableStatuses,
} from "./tableReservationService.js";
import { notifyWaitlistInvite } from "./tableReservationNotify.js";
import { WAITLIST_INVITE_TIMEOUT_MINUTES } from "../shared/waitlist.js";

export function computeWaitlistInviteExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + WAITLIST_INVITE_TIMEOUT_MINUTES * 60_000);
}

const ACTIVE_QUEUE: WaitlistEntryStatus[] = ["WAITING", "INVITED", "ACCEPTED"];

export async function guestHasActiveWaitlistEntry(
  businessId: number,
  guestTelegramId: string,
): Promise<boolean> {
  const count = await prisma.waitlistEntry.count({
    where: {
      businessId,
      guestTelegramId,
      status: { in: ACTIVE_QUEUE },
    },
  });
  return count > 0;
}

async function pickNextWaitingEntry(
  businessId: number,
  tableSeats: number,
): Promise<{ id: number; partySize: number; guestTelegramId: string | null } | null> {
  const rows = await prisma.waitlistEntry.findMany({
    where: {
      businessId,
      status: "WAITING",
      partySize: { lte: tableSeats },
    },
    orderBy: [{ preferredAt: "asc" }, { createdAt: "asc" }],
    take: 20,
    select: {
      id: true,
      partySize: true,
      guestTelegramId: true,
      preferredAt: true,
      createdAt: true,
    },
  });

  if (rows.length === 0) return null;

  const now = Date.now();
  rows.sort((a, b) => {
    const aPref = a.preferredAt?.getTime() ?? now + 86400000;
    const bPref = b.preferredAt?.getTime() ?? now + 86400000;
    const prefDiff = aPref - bPref;
    if (prefDiff !== 0) return prefDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const best = rows[0]!;
  if (!best.guestTelegramId?.trim()) return null;
  return best;
}

async function tableIsFreeForWaitlist(
  businessId: number,
  tableId: number,
): Promise<boolean> {
  const table = await prisma.diningTable.findFirst({
    where: { id: tableId, businessId, isActive: true },
    select: { liveStatus: true, activeSessionId: true },
  });
  if (!table) return false;
  if (table.activeSessionId != null) return false;
  return table.liveStatus === "FREE";
}

/** Invite next guest when a table becomes available. */
export async function tryInviteWaitlistForTable(
  businessId: number,
  tableId: number,
  now = new Date(),
): Promise<number | null> {
  const table = await prisma.diningTable.findFirst({
    where: { id: tableId, businessId, isActive: true },
    select: { id: true, name: true, seats: true, liveStatus: true, activeSessionId: true },
  });
  if (!table || table.activeSessionId != null || table.liveStatus !== "FREE") {
    return null;
  }

  const pendingInvite = await prisma.waitlistEntry.findFirst({
    where: {
      businessId,
      assignedTableId: tableId,
      status: "INVITED",
      inviteExpiresAt: { gt: now },
    },
    select: { id: true },
  });
  if (pendingInvite) return null;

  const next = await pickNextWaitingEntry(businessId, table.seats);
  if (!next) return null;

  const inviteExpiresAt = computeWaitlistInviteExpiresAt(now);
  await prisma.waitlistEntry.update({
    where: { id: next.id },
    data: {
      status: "INVITED",
      assignedTableId: tableId,
      invitedAt: now,
      inviteExpiresAt,
    },
  });

  void notifyWaitlistInvite({
    entryId: next.id,
    businessId,
    guestTelegramId: next.guestTelegramId!,
    tableName: table.name,
    partySize: next.partySize,
    inviteExpiresAt,
  });

  publishVenueUpdate(businessId, "floor");
  return next.id;
}

export async function tryInviteWaitlistForAllFreeTables(
  businessId: number,
  now = new Date(),
): Promise<number> {
  const freeTables = await prisma.diningTable.findMany({
    where: {
      businessId,
      isActive: true,
      liveStatus: "FREE",
      activeSessionId: null,
    },
    select: { id: true },
  });

  let invited = 0;
  for (const t of freeTables) {
    const id = await tryInviteWaitlistForTable(businessId, t.id, now);
    if (id != null) invited += 1;
  }
  return invited;
}

export async function acceptWaitlistInvite(
  entryId: number,
  guestTelegramId: string,
  now = new Date(),
): Promise<
  | { ok: true; reservationId: number }
  | { ok: false; error: string; statusCode: number }
> {
  const entry = await prisma.waitlistEntry.findUnique({
    where: { id: entryId },
    include: {
      assignedTable: { select: { id: true, name: true, seats: true, businessId: true } },
      business: { select: { name: true } },
    },
  });

  if (!entry) {
    return { ok: false, statusCode: 404, error: "Запись не найдена" };
  }
  if (entry.guestTelegramId?.trim() !== guestTelegramId.trim()) {
    return { ok: false, statusCode: 403, error: "Нет доступа" };
  }
  if (entry.status !== "INVITED") {
    return { ok: false, statusCode: 409, error: "Приглашение недоступно" };
  }
  if (entry.inviteExpiresAt && entry.inviteExpiresAt.getTime() <= now.getTime()) {
    return { ok: false, statusCode: 409, error: "Время приглашения истекло" };
  }
  if (!entry.assignedTableId || !entry.assignedTable) {
    return { ok: false, statusCode: 409, error: "Стол не назначен" };
  }

  const free = await tableIsFreeForWaitlist(entry.businessId, entry.assignedTableId);
  if (!free) {
    return { ok: false, statusCode: 409, error: "Стол уже занят" };
  }

  const reservedAt =
    entry.preferredAt && entry.preferredAt.getTime() > now.getTime()
      ? entry.preferredAt
      : new Date(now.getTime() + 10 * 60_000);

  const conflict = await hasReservationConflict(
    entry.businessId,
    entry.assignedTableId,
    reservedAt,
    90,
  );
  if (conflict) {
    return { ok: false, statusCode: 409, error: "Стол уже забронирован" };
  }

  const reservation = await prisma.$transaction(async (tx) => {
    const created = await tx.tableReservation.create({
      data: {
        businessId: entry.businessId,
        tableId: entry.assignedTableId!,
        reservedAt,
        partySize: entry.partySize,
        guestName: entry.guestName,
        guestPhone: entry.guestPhone,
        guestNote: entry.guestNote,
        guestTelegramId: entry.guestTelegramId,
        status: "CONFIRMED",
        durationMinutes: 90,
        depositStatus: "NONE",
      },
    });

    await tx.waitlistEntry.update({
      where: { id: entryId },
      data: {
        status: "ACCEPTED",
        reservationId: created.id,
      },
    });

    return created;
  });

  await syncDiningTableStatuses(entry.businessId);
  publishVenueUpdate(entry.businessId, "floor");

  return { ok: true, reservationId: reservation.id };
}

export async function declineWaitlistInvite(
  entryId: number,
  guestTelegramId: string,
  now = new Date(),
): Promise<{ ok: true } | { ok: false; error: string; statusCode: number }> {
  const entry = await prisma.waitlistEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      businessId: true,
      status: true,
      guestTelegramId: true,
      assignedTableId: true,
    },
  });

  if (!entry) {
    return { ok: false, statusCode: 404, error: "Запись не найдена" };
  }
  if (entry.guestTelegramId?.trim() !== guestTelegramId.trim()) {
    return { ok: false, statusCode: 403, error: "Нет доступа" };
  }
  if (entry.status !== "INVITED") {
    return { ok: false, statusCode: 409, error: "Приглашение недоступно" };
  }

  const tableId = entry.assignedTableId;
  await prisma.waitlistEntry.update({
    where: { id: entryId },
    data: {
      status: "DECLINED",
      declinedAt: now,
      assignedTableId: null,
      invitedAt: null,
      inviteExpiresAt: null,
    },
  });

  publishVenueUpdate(entry.businessId, "floor");
  if (tableId != null) {
    await tryInviteWaitlistForTable(entry.businessId, tableId, now);
  }

  return { ok: true };
}

export async function expireStaleWaitlistInvitesOnce(now = new Date()): Promise<number> {
  const due = await prisma.waitlistEntry.findMany({
    where: {
      status: "INVITED",
      inviteExpiresAt: { lte: now },
    },
    select: { id: true, businessId: true, assignedTableId: true },
    take: 50,
  });

  for (const row of due) {
    const tableId = row.assignedTableId;
    await prisma.waitlistEntry.update({
      where: { id: row.id },
      data: {
        status: "EXPIRED",
        expiredAt: now,
        assignedTableId: null,
        invitedAt: null,
        inviteExpiresAt: null,
      },
    });
    publishVenueUpdate(row.businessId, "floor");
    if (tableId != null) {
      await tryInviteWaitlistForTable(row.businessId, tableId, now);
    }
  }

  return due.length;
}

export async function markWaitlistSeatedForReservation(
  reservationId: number,
  now = new Date(),
): Promise<void> {
  const entry = await prisma.waitlistEntry.findFirst({
    where: { reservationId, status: "ACCEPTED" },
    select: { id: true, businessId: true },
  });
  if (!entry) return;

  await prisma.waitlistEntry.update({
    where: { id: entry.id },
    data: { status: "SEATED", seatedAt: now },
  });
  publishVenueUpdate(entry.businessId, "floor");
}

export async function buildWaitlistBoard(businessId: number) {
  const now = new Date();
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60_000);

  const [waiting, invited, recent] = await Promise.all([
    prisma.waitlistEntry.findMany({
      where: { businessId, status: "WAITING" },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: {
        id: true,
        partySize: true,
        guestName: true,
        guestPhone: true,
        guestNote: true,
        preferredAt: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.waitlistEntry.findMany({
      where: { businessId, status: "INVITED" },
      orderBy: { invitedAt: "asc" },
      take: 50,
      include: { assignedTable: { select: { name: true } } },
    }),
    prisma.waitlistEntry.findMany({
      where: {
        businessId,
        createdAt: { gte: since7d },
        status: { in: ["SEATED", "DECLINED", "EXPIRED", "CANCELLED"] },
      },
      select: { status: true, createdAt: true, seatedAt: true },
    }),
  ]);

  const waitDurations = recent
    .filter((r) => r.status === "SEATED" && r.seatedAt)
    .map((r) => (r.seatedAt!.getTime() - r.createdAt.getTime()) / 60_000);

  const avgWaitMinutes =
    waitDurations.length > 0
      ? Math.round(waitDurations.reduce((a, b) => a + b, 0) / waitDurations.length)
      : 0;

  const analytics = {
    waitingCount: waiting.length,
    activeInvitesCount: invited.length,
    avgWaitMinutes,
    seated7d: recent.filter((r) => r.status === "SEATED").length,
    declined7d: recent.filter((r) => r.status === "DECLINED").length,
    expired7d: recent.filter((r) => r.status === "EXPIRED").length,
    left7d:
      recent.filter((r) => r.status === "DECLINED").length +
      recent.filter((r) => r.status === "EXPIRED").length +
      recent.filter((r) => r.status === "CANCELLED").length,
  };

  return {
    at: now.toISOString(),
    analytics,
    waiting: waiting.map((w) => ({
      ...w,
      preferredAt: w.preferredAt?.toISOString() ?? null,
      createdAt: w.createdAt.toISOString(),
      waitMinutes: Math.round((now.getTime() - w.createdAt.getTime()) / 60_000),
    })),
    invited: invited.map((i) => ({
      id: i.id,
      partySize: i.partySize,
      guestName: i.guestName,
      guestPhone: i.guestPhone,
      status: i.status,
      tableName: i.assignedTable?.name ?? null,
      invitedAt: i.invitedAt?.toISOString() ?? null,
      inviteExpiresAt: i.inviteExpiresAt?.toISOString() ?? null,
    })),
  };
}

export async function loadWaitlistNextByTable(
  businessId: number,
): Promise<Map<number, { guestName: string; partySize: number }>> {
  const invited = await prisma.waitlistEntry.findMany({
    where: {
      businessId,
      status: "INVITED",
      assignedTableId: { not: null },
    },
    select: {
      assignedTableId: true,
      guestName: true,
      partySize: true,
      invitedAt: true,
    },
    orderBy: { invitedAt: "asc" },
  });

  const map = new Map<number, { guestName: string; partySize: number }>();
  for (const row of invited) {
    if (row.assignedTableId == null || map.has(row.assignedTableId)) continue;
    map.set(row.assignedTableId, {
      guestName: row.guestName,
      partySize: row.partySize,
    });
  }
  return map;
}

export function waitlistEntryDto(row: {
  id: number;
  partySize: number;
  guestName: string;
  guestPhone: string;
  guestNote: string | null;
  preferredAt: Date | null;
  status: WaitlistEntryStatus;
  assignedTableId: number | null;
  invitedAt: Date | null;
  inviteExpiresAt: Date | null;
  reservationId: number | null;
  createdAt: Date;
  assignedTable?: { name: string } | null;
}) {
  return {
    id: row.id,
    partySize: row.partySize,
    guestName: row.guestName,
    guestPhone: row.guestPhone,
    guestNote: row.guestNote,
    preferredAt: row.preferredAt?.toISOString() ?? null,
    status: row.status,
    assignedTableId: row.assignedTableId,
    tableName: row.assignedTable?.name ?? null,
    invitedAt: row.invitedAt?.toISOString() ?? null,
    inviteExpiresAt: row.inviteExpiresAt?.toISOString() ?? null,
    reservationId: row.reservationId,
    createdAt: row.createdAt.toISOString(),
  };
}
