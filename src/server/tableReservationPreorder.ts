import type { ReservationPreorderStatus } from "@prisma/client";
import { prisma } from "./db.js";
import {
  ACTIVE_PREORDER_STATUSES,
  UNPAID_PREORDER_STATUSES,
  type ReservationPreorderGuestStatus,
  preorderGuestLabel,
  preorderGuestStatusFromOrders,
} from "../shared/reservationPreorder.js";
import { isReservationDepositBlockingPreorder } from "../shared/reservationDeposit.js";
import { onOrderStatusChanged } from "./orderInventoryHooks.js";
import { loadOrderLinesForStock, releaseOrderStock } from "./inventoryService.js";

export type PreorderReservationContext = {
  id: number;
  businessId: number;
  tableId: number;
  tableName: string;
  reservedAt: Date;
  partySize: number | null;
  status: string;
  hasPreorder: boolean;
  preorderGuestStatus: ReservationPreorderGuestStatus;
  preorderLabel: string;
};

export type ReservationPreorderSummary = {
  hasPaidPreorder: boolean;
  hasPendingPreorder: boolean;
  guestStatus: ReservationPreorderGuestStatus;
  label: string;
};

export async function loadReservationPreorderSummaries(
  reservationIds: number[],
): Promise<Map<number, ReservationPreorderSummary>> {
  const map = new Map<number, ReservationPreorderSummary>();
  if (reservationIds.length === 0) return map;

  for (const id of reservationIds) {
    map.set(id, {
      hasPaidPreorder: false,
      hasPendingPreorder: false,
      guestStatus: "none",
      label: preorderGuestLabel("none"),
    });
  }

  const rows = await prisma.order.findMany({
    where: {
      reservationId: { in: reservationIds },
      preorderStatus: { in: ACTIVE_PREORDER_STATUSES },
    },
    select: { reservationId: true, preorderStatus: true },
  });

  const byReservation = new Map<number, ReservationPreorderStatus[]>();
  for (const row of rows) {
    if (row.reservationId == null || row.preorderStatus == null) continue;
    const list = byReservation.get(row.reservationId) ?? [];
    list.push(row.preorderStatus);
    byReservation.set(row.reservationId, list);
  }

  for (const [reservationId, statuses] of byReservation) {
    const guestStatus = preorderGuestStatusFromOrders(statuses);
    map.set(reservationId, {
      hasPaidPreorder: guestStatus === "paid",
      hasPendingPreorder: guestStatus === "pending",
      guestStatus,
      label: preorderGuestLabel(guestStatus),
    });
  }

  return map;
}

/** @deprecated use loadReservationPreorderSummaries */
export async function loadReservationPreorderFlags(
  reservationIds: number[],
): Promise<Map<number, boolean>> {
  const summaries = await loadReservationPreorderSummaries(reservationIds);
  const map = new Map<number, boolean>();
  for (const id of reservationIds) {
    map.set(id, summaries.get(id)?.hasPaidPreorder ?? false);
  }
  return map;
}

export async function hasActiveReservationPreorder(
  reservationId: number,
): Promise<boolean> {
  const count = await prisma.order.count({
    where: {
      reservationId,
      preorderStatus: { in: ACTIVE_PREORDER_STATUSES },
    },
  });
  return count > 0;
}

export async function cancelUnpaidPreordersForReservation(
  reservationId: number,
  businessId: number,
): Promise<number> {
  const orders = await prisma.order.findMany({
    where: {
      reservationId,
      businessId,
      preorderStatus: { in: UNPAID_PREORDER_STATUSES },
      status: { in: ["NEW", "ACCEPTED", "PAID_PENDING"] },
    },
    select: { id: true, status: true },
  });

  let cancelled = 0;
  for (const order of orders) {
    const lines = await loadOrderLinesForStock(order.id);
    await prisma.$transaction(async (tx) => {
      await releaseOrderStock(tx, businessId, order.id, lines);
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          preorderStatus: "PREORDER_CANCELLED",
        },
      });
    });
    await onOrderStatusChanged(order.id, order.status, "CANCELLED");
    cancelled += 1;
  }
  return cancelled;
}

export async function assertReservationPreorderEligible(input: {
  businessId: number;
  reservationId: number;
  guestTelegramId: string;
}): Promise<
  | { ok: true; reservation: PreorderReservationContext }
  | { ok: false; error: string; status: number }
> {
  const reservation = await prisma.tableReservation.findFirst({
    where: { id: input.reservationId, businessId: input.businessId },
    include: { table: { select: { name: true } } },
  });

  if (!reservation) {
    return { ok: false, error: "Бронь не найдена", status: 404 };
  }

  const guestTg = reservation.guestTelegramId?.trim() ?? "";
  if (guestTg === "" || guestTg !== input.guestTelegramId.trim()) {
    return { ok: false, error: "Бронь недоступна", status: 403 };
  }

  if (reservation.status !== "CONFIRMED") {
    return {
      ok: false,
      error: "Предзаказ доступен только для подтверждённой брони",
      status: 409,
    };
  }

  if (isReservationDepositBlockingPreorder(reservation.depositStatus)) {
    return {
      ok: false,
      error: "Сначала оплатите депозит за бронь",
      status: 409,
    };
  }

  const summaries = await loadReservationPreorderSummaries([reservation.id]);
  const summary = summaries.get(reservation.id)!;

  if (summary.guestStatus === "paid") {
    return {
      ok: false,
      error: "Предзаказ к этой брони уже оплачен",
      status: 409,
    };
  }

  if (summary.guestStatus === "pending") {
    return {
      ok: false,
      error: "У вас уже есть неоплаченный предзаказ. Завершите оплату или дождитесь отмены.",
      status: 409,
    };
  }

  return {
    ok: true,
    reservation: {
      id: reservation.id,
      businessId: reservation.businessId,
      tableId: reservation.tableId,
      tableName: reservation.table.name,
      reservedAt: reservation.reservedAt,
      partySize: reservation.partySize,
      status: reservation.status,
      hasPreorder: summary.hasPaidPreorder,
      preorderGuestStatus: summary.guestStatus,
      preorderLabel: summary.label,
    },
  };
}

export async function resolveCheckoutReservationId(input: {
  businessId: number;
  reservationId: unknown;
  guestTelegramId: string;
  hasTableSession: boolean;
}): Promise<number | null> {
  if (input.reservationId == null || input.reservationId === "") return null;
  if (input.hasTableSession) {
    throw new Error("RESERVATION_SESSION_CONFLICT");
  }

  const id = Math.floor(Number(input.reservationId));
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("INVALID_RESERVATION");
  }

  const check = await assertReservationPreorderEligible({
    businessId: input.businessId,
    reservationId: id,
    guestTelegramId: input.guestTelegramId,
  });
  if (!check.ok) {
    throw new Error(`RESERVATION:${check.status}:${check.error}`);
  }

  return id;
}

export async function markReservationPreorderPaymentPending(orderId: number): Promise<void> {
  await prisma.order.updateMany({
    where: {
      id: orderId,
      reservationId: { not: null },
      preorderStatus: "PREORDER_DRAFT",
    },
    data: { preorderStatus: "PREORDER_PAYMENT_PENDING" },
  });
}

export async function markReservationPreorderCancelled(orderId: number): Promise<void> {
  await prisma.order.updateMany({
    where: {
      id: orderId,
      reservationId: { not: null },
      preorderStatus: { in: UNPAID_PREORDER_STATUSES },
    },
    data: { preorderStatus: "PREORDER_CANCELLED" },
  });
}

export async function notifyAdminReservationPreorderPaid(orderId: number): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      businessId: true,
      total: true,
      name: true,
      reservation: {
        select: {
          id: true,
          table: { select: { name: true } },
        },
      },
    },
  });
  if (!order?.reservation) return;

  try {
    const { createMerchantNotification } = await import("./merchantNotificationsService.js");
    const { publishVenueUpdate } = await import("./venueRealtime.js");
    void createMerchantNotification({
      businessId: order.businessId,
      kind: "ORDER_NEW",
      title: `Предзаказ к брони #${order.reservation.id}`,
      body: `${order.name} · ${order.total} сом · ${order.reservation.table.name}`,
      href: "#/admin/kitchen",
    });
    publishVenueUpdate(order.businessId, "kitchen");
  } catch (e) {
    console.error("notifyAdminReservationPreorderPaid:", e);
  }
}
