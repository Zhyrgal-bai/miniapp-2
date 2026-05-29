import type { OrderPrepStatus, Prisma, TableLiveStatus } from "@prisma/client";
import { prisma } from "./db.js";
import { publishVenueUpdate } from "./venueRealtime.js";
import { businessTypeSupportsTableReservations } from "../shared/tableReservation.js";
import {
  KITCHEN_ACTIVE_PREP_STATUSES,
  KITCHEN_PREORDER_ACTIVE_PREP_STATUSES,
  KITCHEN_SCHEDULED_PREP_STATUSES,
} from "../shared/venueOperations.js";
import { formatMinutesUntil } from "./reservationPreorderKitchenScheduler.js";
import { loadWaitlistNextByTable } from "./tableReservationWaitlistService.js";

export async function assertVenueBusiness(businessId: number): Promise<boolean> {
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: { businessType: true, isActive: true, isBlocked: true, name: true },
  });
  if (!b || !b.isActive || b.isBlocked) return false;
  return businessTypeSupportsTableReservations(b.businessType);
}

export function seatedMinutes(seatedAt: Date, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - seatedAt.getTime()) / 60_000));
}

export async function buildFloorSnapshot(businessId: number) {
  const now = new Date();
  const tables = await prisma.diningTable.findMany({
    where: { businessId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      activeSession: {
        include: {
          orders: {
            where: { status: { notIn: ["CANCELLED"] } },
            orderBy: { createdAt: "desc" },
            take: 3,
            select: {
              id: true,
              orderNumber: true,
              total: true,
              prepStatus: true,
              status: true,
            },
          },
        },
      },
    },
  });

  const reservations = await prisma.tableReservation.findMany({
    where: {
      businessId,
      status: { in: ["PENDING", "CONFIRMED"] },
      reservedAt: { gte: now },
    },
    orderBy: { reservedAt: "asc" },
    take: 40,
    select: {
      id: true,
      tableId: true,
      reservedAt: true,
      guestName: true,
      partySize: true,
      status: true,
    },
  });

  const waitlistNext = await loadWaitlistNextByTable(businessId);

  return {
    at: now.toISOString(),
    tables: tables.map((t) => ({
      id: t.id,
      name: t.name,
      seats: t.seats,
      shape: t.shape,
      posX: t.posX,
      posY: t.posY,
      width: t.width,
      height: t.height,
      liveStatus: t.liveStatus,
      qrToken: t.qrToken,
      waitlistNext: waitlistNext.get(t.id) ?? null,
      session: t.activeSession
        ? {
            id: t.activeSession.id,
            partySize: t.activeSession.partySize,
            seatedAt: t.activeSession.seatedAt.toISOString(),
            seatedMinutes: seatedMinutes(t.activeSession.seatedAt, now),
            status: t.activeSession.status,
            paymentRequestedAt: t.activeSession.paymentRequestedAt?.toISOString() ?? null,
            orders: t.activeSession.orders,
          }
        : null,
    })),
    reservations,
  };
}

export async function openTableSession(input: {
  businessId: number;
  tableId: number;
  reservationId?: number | null;
  waiterStaffId?: number | null;
  partySize?: number | null;
}): Promise<{ sessionId: number }> {
  const table = await prisma.diningTable.findFirst({
    where: { id: input.tableId, businessId: input.businessId, isActive: true },
  });
  if (!table) throw new Error("TABLE_NOT_FOUND");
  if (table.activeSessionId != null) throw new Error("TABLE_BUSY");

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.tableSession.create({
      data: {
        businessId: input.businessId,
        tableId: input.tableId,
        reservationId: input.reservationId ?? null,
        waiterStaffId: input.waiterStaffId ?? null,
        partySize: input.partySize ?? null,
        status: "ACTIVE",
      },
    });
    await tx.diningTable.update({
      where: { id: input.tableId },
      data: {
        liveStatus: "ARRIVED",
        activeSessionId: created.id,
        status: "OCCUPIED",
      },
    });
    if (input.reservationId != null) {
      await tx.tableReservation.updateMany({
        where: { id: input.reservationId, businessId: input.businessId },
        data: { status: "ARRIVED" },
      });
    }
    return created;
  });

  if (input.reservationId != null) {
    const { markWaitlistSeatedForReservation } = await import(
      "./tableReservationWaitlistService.js"
    );
    void markWaitlistSeatedForReservation(input.reservationId).catch((e) =>
      console.error("markWaitlistSeatedForReservation:", e),
    );
  }

  publishVenueUpdate(input.businessId, "floor");
  publishVenueUpdate(input.businessId, "session");
  return { sessionId: session.id };
}

export async function setTableLiveStatus(
  businessId: number,
  tableId: number,
  liveStatus: TableLiveStatus,
): Promise<void> {
  await prisma.diningTable.updateMany({
    where: { id: tableId, businessId },
    data: { liveStatus, status: legacyStatusFromLive(liveStatus) },
  });
  publishVenueUpdate(businessId, "floor");

  if (liveStatus === "FREE") {
    const { tryInviteWaitlistForTable } = await import(
      "./tableReservationWaitlistService.js"
    );
    void tryInviteWaitlistForTable(businessId, tableId).catch((e) =>
      console.error("tryInviteWaitlistForTable:", e),
    );
  }
}

function legacyStatusFromLive(live: TableLiveStatus): "AVAILABLE" | "OCCUPIED" | "RESERVED" | "SOON_OCCUPIED" {
  if (live === "FREE" || live === "CLEANING") return "AVAILABLE";
  if (live === "RESERVED") return "RESERVED";
  if (live === "ARRIVED" || live === "ORDERING") return "SOON_OCCUPIED";
  return "OCCUPIED";
}

export async function requestSessionPayment(
  businessId: number,
  sessionId: number,
): Promise<void> {
  const session = await prisma.tableSession.findFirst({
    where: { id: sessionId, businessId, status: "ACTIVE" },
    include: { table: true },
  });
  if (!session) throw new Error("SESSION_NOT_FOUND");

  await prisma.$transaction([
    prisma.tableSession.update({
      where: { id: sessionId },
      data: { status: "PAYMENT_REQUESTED", paymentRequestedAt: new Date() },
    }),
    prisma.diningTable.update({
      where: { id: session.tableId },
      data: { liveStatus: "PAYMENT" },
    }),
  ]);

  publishVenueUpdate(businessId, "floor");
  publishVenueUpdate(businessId, "session");
}

export async function closeTableSession(
  businessId: number,
  sessionId: number,
): Promise<void> {
  const session = await prisma.tableSession.findFirst({
    where: { id: sessionId, businessId },
  });
  if (!session) throw new Error("SESSION_NOT_FOUND");

  await prisma.$transaction([
    prisma.tableSession.update({
      where: { id: sessionId },
      data: { status: "CLOSED", closedAt: new Date() },
    }),
    prisma.diningTable.update({
      where: { id: session.tableId },
      data: {
        liveStatus: "CLEANING",
        activeSessionId: null,
        status: "AVAILABLE",
      },
    }),
  ]);

  publishVenueUpdate(businessId, "floor");
}

export async function attachOrderToSession(
  businessId: number,
  orderId: number,
  tableSessionId: number,
): Promise<void> {
  const session = await prisma.tableSession.findFirst({
    where: { id: tableSessionId, businessId, status: { in: ["ACTIVE", "PAYMENT_REQUESTED"] } },
  });
  if (!session) throw new Error("SESSION_NOT_FOUND");

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId, businessId },
      data: { tableSessionId, prepStatus: "PREPARING" },
    }),
    prisma.diningTable.update({
      where: { id: session.tableId },
      data: { liveStatus: "ORDERING" },
    }),
  ]);

  publishVenueUpdate(businessId, "kitchen");
  publishVenueUpdate(businessId, "floor");
}

export async function setOrderPrepStatus(
  businessId: number,
  orderId: number,
  prepStatus: OrderPrepStatus,
): Promise<void> {
  const existing = await prisma.order.findFirst({
    where: { id: orderId, businessId },
    select: { prepStatus: true, reservationId: true, tableSessionId: true },
  });
  if (!existing) {
    throw new Error("ORDER_NOT_FOUND");
  }

  if (existing.reservationId != null) {
    const allowed: OrderPrepStatus[] = [
      "READY_FOR_PREP",
      "PREPARING",
      "READY",
      "SERVED",
    ];
    if (!allowed.includes(prepStatus)) {
      throw new Error("INVALID_PREP_TRANSITION");
    }
    const cur = existing.prepStatus;
    const valid =
      (cur === "READY_FOR_PREP" && prepStatus === "PREPARING") ||
      (cur === "PREPARING" && prepStatus === "READY") ||
      (cur === "READY" && prepStatus === "SERVED");
    if (!valid) {
      throw new Error("INVALID_PREP_TRANSITION");
    }
  } else if (!KITCHEN_ACTIVE_PREP_STATUSES.includes(prepStatus) && prepStatus !== "NONE") {
    throw new Error("INVALID_PREP_TRANSITION");
  }

  const order = await prisma.order.update({
    where: { id: orderId, businessId },
    data: { prepStatus },
    select: { tableSessionId: true, tableSession: { select: { tableId: true } } },
  });

  if (order.tableSessionId && order.tableSession) {
    const live: TableLiveStatus =
      prepStatus === "SERVED" ? "EATING" : prepStatus === "READY" ? "ORDERING" : "ORDERING";
    if (prepStatus === "SERVED") {
      await prisma.diningTable.update({
        where: { id: order.tableSession.tableId },
        data: { liveStatus: "EATING" },
      });
    }
    void live;
  }

  publishVenueUpdate(businessId, "kitchen");
  publishVenueUpdate(businessId, "floor");
}

export async function buildKitchenBoard(businessId: number) {
  const orders = await prisma.order.findMany({
    where: {
      businessId,
      reservationId: null,
      prepStatus: { in: ["PREPARING", "READY", "SERVED"] },
      status: { notIn: ["CANCELLED"] },
      createdAt: { gte: new Date(Date.now() - 12 * 60 * 60_000) },
    },
    orderBy: { createdAt: "asc" },
    take: 80,
    select: {
      id: true,
      orderNumber: true,
      prepStatus: true,
      status: true,
      total: true,
      createdAt: true,
      tableSession: {
        select: { table: { select: { name: true } } },
      },
    },
  });

  const preorderSelect = {
    id: true,
    orderNumber: true,
    prepStatus: true,
    status: true,
    total: true,
    createdAt: true,
    name: true,
    kitchenPrepAt: true,
    items: { select: { name: true, quantity: true } },
    reservation: {
      select: {
        id: true,
        reservedAt: true,
        partySize: true,
        guestName: true,
        table: { select: { name: true } },
      },
    },
  } as const;

  const mapPreorder = (o: {
    id: number;
    orderNumber: string | null;
    prepStatus: OrderPrepStatus;
    status: string;
    total: number;
    createdAt: Date;
    name: string;
    kitchenPrepAt: Date | null;
    items: Array<{ name: string; quantity: number }>;
    reservation: {
      id: number;
      reservedAt: Date;
      partySize: number | null;
      guestName: string | null;
      table: { name: string };
    } | null;
  }) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    prepStatus: o.prepStatus,
    status: o.status,
    total: o.total,
    createdAt: o.createdAt.toISOString(),
    customerName: o.name,
    kitchenPrepAt: o.kitchenPrepAt?.toISOString() ?? null,
    startsInLabel: o.kitchenPrepAt
      ? formatMinutesUntil(o.kitchenPrepAt.toISOString())
      : null,
    items: o.items.map((it) => ({ name: it.name, quantity: it.quantity })),
    reservation: o.reservation
      ? {
          id: o.reservation.id,
          reservedAt: o.reservation.reservedAt.toISOString(),
          guestName: o.reservation.guestName,
          partySize: o.reservation.partySize,
          tableName: o.reservation.table.name,
        }
      : null,
  });

  const preordersScheduled = await prisma.order.findMany({
    where: {
      businessId,
      reservationId: { not: null },
      preorderStatus: "PREORDER_PAID",
      prepStatus: { in: KITCHEN_SCHEDULED_PREP_STATUSES },
      status: { notIn: ["CANCELLED"] },
    },
    orderBy: { kitchenPrepAt: "asc" },
    take: 50,
    select: preorderSelect,
  });

  const preordersActive = await prisma.order.findMany({
    where: {
      businessId,
      reservationId: { not: null },
      preorderStatus: "PREORDER_PAID",
      prepStatus: { in: KITCHEN_PREORDER_ACTIVE_PREP_STATUSES },
      status: { notIn: ["CANCELLED"] },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: preorderSelect,
  });

  return {
    at: new Date().toISOString(),
    orders,
    preordersScheduled: preordersScheduled.map(mapPreorder),
    preordersActive: preordersActive.map(mapPreorder),
    /** @deprecated use preordersActive */
    preorders: preordersActive.map(mapPreorder),
  };
}

export async function resolveTableQrToken(token: string) {
  const table = await prisma.diningTable.findFirst({
    where: { qrToken: token, isActive: true },
    include: {
      business: { select: { id: true, name: true, businessType: true, isActive: true, isBlocked: true } },
      activeSession: { select: { id: true, status: true, partySize: true } },
    },
  });
  if (!table?.business?.isActive || table.business.isBlocked) return null;
  if (!businessTypeSupportsTableReservations(table.business.businessType)) return null;
  return table;
}

export async function joinTableViaQr(input: {
  qrToken: string;
  telegramId: string;
  partySize?: number;
}): Promise<{ businessId: number; tableSessionId: number; tableName: string } | null> {
  const table = await resolveTableQrToken(input.qrToken);
  if (!table) return null;

  let sessionId = table.activeSessionId;
  if (sessionId == null) {
    const opened = await openTableSession({
      businessId: table.businessId,
      tableId: table.id,
      partySize: input.partySize ?? 2,
    });
    sessionId = opened.sessionId;
  }

  return {
    businessId: table.businessId,
    tableSessionId: sessionId,
    tableName: table.name,
  };
}

export async function buildVenueMetrics(businessId: number) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60_000);
  const sessions = await prisma.tableSession.findMany({
    where: { businessId, seatedAt: { gte: since }, closedAt: { not: null } },
    select: { seatedAt: true, closedAt: true, tableId: true },
  });

  const durations = sessions
    .filter((s) => s.closedAt)
    .map((s) => (s.closedAt!.getTime() - s.seatedAt.getTime()) / 60_000);

  const avgTableMinutes =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

  const tableCount = await prisma.diningTable.count({
    where: { businessId, isActive: true },
  });

  const activeNow = await prisma.tableSession.count({
    where: { businessId, status: { in: ["ACTIVE", "PAYMENT_REQUESTED"] } },
  });

  const hourBuckets = new Array(24).fill(0) as number[];
  for (const s of sessions) {
    const h = s.seatedAt.getHours();
    if (h >= 0 && h < 24) hourBuckets[h] = (hourBuckets[h] ?? 0) + 1;
  }
  const peak = Math.max(0, ...hourBuckets);
  const busiestHour = peak > 0 ? hourBuckets.indexOf(peak) : -1;

  return {
    avgTableMinutes,
    tableCount,
    activeSessions: activeNow,
    turnover7d: sessions.length,
    busiestHour: busiestHour >= 0 ? `${String(busiestHour).padStart(2, "0")}:00` : null,
    occupancyPercent:
      tableCount > 0 ? Math.round((activeNow / tableCount) * 100) : 0,
  };
}
