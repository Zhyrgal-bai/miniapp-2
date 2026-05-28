import type { DiningTableStatus, TableReservationStatus } from "@prisma/client";
import { prisma } from "./db.js";
import {
  ACTIVE_RESERVATION_STATUSES,
  DEFAULT_RESERVATION_DURATION_MIN,
  SOON_OCCUPIED_MINUTES,
  SLOT_STEP_MINUTES,
  VENUE_CLOSE_HOUR,
  VENUE_OPEN_HOUR,
  rangesOverlap,
  reservationEndsAt,
} from "../shared/tableReservation.js";

type ReservationRow = {
  id: number;
  tableId: number;
  reservedAt: Date;
  durationMinutes: number;
  status: TableReservationStatus;
};

export function parseReservedAtIso(raw: string): Date | null {
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function slotTimesForDate(dateYmd: string): string[] {
  const [y, m, d] = dateYmd.split("-").map((x) => Number(x));
  if (!y || !m || !d) return [];
  const out: string[] = [];
  for (let hour = VENUE_OPEN_HOUR; hour < VENUE_CLOSE_HOUR; hour++) {
    for (let min = 0; min < 60; min += SLOT_STEP_MINUTES) {
      if (hour === VENUE_CLOSE_HOUR - 1 && min >= 60 - SLOT_STEP_MINUTES) break;
      const hh = String(hour).padStart(2, "0");
      const mm = String(min).padStart(2, "0");
      out.push(`${hh}:${mm}`);
    }
  }
  return out;
}

export function slotToDate(dateYmd: string, hhmm: string): Date | null {
  const iso = `${dateYmd}T${hhmm}:00`;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function isSlotInPast(slotStart: Date, now = new Date()): boolean {
  return slotStart.getTime() <= now.getTime();
}

export function filterAvailableSlots(
  dateYmd: string,
  reservations: ReservationRow[],
  durationMinutes: number,
  now = new Date(),
): { time: string; available: boolean; reservedAt: string }[] {
  const times = slotTimesForDate(dateYmd);
  return times.map((time) => {
    const start = slotToDate(dateYmd, time);
    if (!start) return { time, available: false, reservedAt: "" };
    if (isSlotInPast(start, now)) {
      return { time, available: false, reservedAt: start.toISOString() };
    }
    const end = reservationEndsAt(start, durationMinutes);
    const conflict = reservations.some((r) => {
      if (!ACTIVE_RESERVATION_STATUSES.includes(r.status)) return false;
      const rEnd = reservationEndsAt(r.reservedAt, r.durationMinutes);
      return rangesOverlap(start, end, r.reservedAt, rEnd);
    });
    return { time, available: !conflict, reservedAt: start.toISOString() };
  });
}

export function computeDisplayStatus(
  manualStatus: DiningTableStatus,
  reservations: ReservationRow[],
  now = new Date(),
): DiningTableStatus {
  if (manualStatus === "OCCUPIED") return "OCCUPIED";

  const active = reservations.filter((r) =>
    ACTIVE_RESERVATION_STATUSES.includes(r.status),
  );

  let hasCurrent = false;
  let hasSoon = false;
  let hasFuture = false;

  for (const r of active) {
    const end = reservationEndsAt(r.reservedAt, r.durationMinutes);
    const msUntil = r.reservedAt.getTime() - now.getTime();
    if (r.status === "ARRIVED" && now >= r.reservedAt && now < end) {
      hasCurrent = true;
    } else if (now >= r.reservedAt && now < end) {
      hasCurrent = true;
    } else if (msUntil > 0 && msUntil <= SOON_OCCUPIED_MINUTES * 60_000) {
      hasSoon = true;
    } else if (r.reservedAt > now) {
      hasFuture = true;
    }
  }

  if (hasCurrent) return "OCCUPIED";
  if (hasSoon) return "SOON_OCCUPIED";
  if (hasFuture) return "RESERVED";
  if (manualStatus === "SOON_OCCUPIED" || manualStatus === "RESERVED") {
    return manualStatus;
  }
  return "AVAILABLE";
}

export function isTableBookable(displayStatus: DiningTableStatus): boolean {
  return displayStatus === "AVAILABLE" || displayStatus === "SOON_OCCUPIED";
}

export async function loadActiveReservations(
  businessId: number,
  from = new Date(),
): Promise<ReservationRow[]> {
  return prisma.tableReservation.findMany({
    where: {
      businessId,
      status: { in: ACTIVE_RESERVATION_STATUSES },
      reservedAt: { gte: new Date(from.getTime() - DEFAULT_RESERVATION_DURATION_MIN * 60_000) },
    },
    select: {
      id: true,
      tableId: true,
      reservedAt: true,
      durationMinutes: true,
      status: true,
    },
    orderBy: { reservedAt: "asc" },
  });
}

export async function hasReservationConflict(
  businessId: number,
  tableId: number,
  start: Date,
  durationMinutes: number,
  excludeId?: number,
): Promise<boolean> {
  const end = reservationEndsAt(start, durationMinutes);
  const rows = await prisma.tableReservation.findMany({
    where: {
      businessId,
      tableId,
      status: { in: ACTIVE_RESERVATION_STATUSES },
      ...(excludeId != null ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      reservedAt: true,
      durationMinutes: true,
    },
  });
  return rows.some((r) => {
    const rEnd = reservationEndsAt(r.reservedAt, r.durationMinutes);
    return rangesOverlap(start, end, r.reservedAt, rEnd);
  });
}

export async function syncDiningTableStatuses(businessId: number): Promise<void> {
  const tables = await prisma.diningTable.findMany({
    where: { businessId, isActive: true },
    select: { id: true, status: true },
  });
  const reservations = await loadActiveReservations(businessId);
  const now = new Date();
  const byTable = new Map<number, ReservationRow[]>();
  for (const r of reservations) {
    const list = byTable.get(r.tableId) ?? [];
    list.push(r);
    byTable.set(r.tableId, list);
  }

  const updates = tables
    .map((t) => {
      const display = computeDisplayStatus(t.status, byTable.get(t.id) ?? [], now);
      if (display === t.status) return null;
      return prisma.diningTable.update({
        where: { id: t.id },
        data: { status: display },
      });
    })
    .filter((u): u is ReturnType<typeof prisma.diningTable.update> => u != null);

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }
}
