import type { TableReservationStatus } from "@prisma/client";
import { prisma } from "./db.js";
import { syncDiningTableStatuses } from "./tableReservationService.js";
import { cancelUnpaidPreordersForReservation } from "./tableReservationPreorder.js";
import {
  initReservationDepositOnConfirm,
  loadReservationDepositSettings,
} from "./tableReservationDeposit.js";
import {
  notifyReservationConfirmed,
  notifyReservationDepositRequired,
  notifyReservationRejected,
} from "./tableReservationNotify.js";

export type ReservationApprovalError =
  | "NOT_FOUND"
  | "WRONG_STATUS"
  | "UPDATE_FAILED";

export type ReservationApprovalResult =
  | { ok: true; status: TableReservationStatus }
  | { ok: false; error: ReservationApprovalError };

async function loadPendingReservation(id: number) {
  return prisma.tableReservation.findUnique({
    where: { id },
    include: {
      table: { select: { name: true } },
      business: { select: { name: true } },
    },
  });
}

export async function confirmTableReservationById(
  id: number,
): Promise<ReservationApprovalResult> {
  const existing = await loadPendingReservation(id);
  if (!existing) return { ok: false, error: "NOT_FOUND" };
  if (existing.status !== "PENDING") return { ok: false, error: "WRONG_STATUS" };

  try {
    const depositSettings = await loadReservationDepositSettings(existing.businessId);
    const depositRequired = depositSettings.enabled && depositSettings.amountSom > 0;

    await prisma.tableReservation.update({
      where: { id },
      data: { status: "CONFIRMED" },
    });

    if (depositRequired) {
      await initReservationDepositOnConfirm(id, depositSettings);
    }

    await syncDiningTableStatuses(existing.businessId);

    if (existing.guestTelegramId) {
      if (depositRequired) {
        void notifyReservationDepositRequired({
          reservationId: id,
          businessId: existing.businessId,
          businessName: existing.business.name,
          guestTelegramId: existing.guestTelegramId,
          tableName: existing.table.name,
          reservedAt: existing.reservedAt,
          depositAmountSom: depositSettings.amountSom,
        });
      } else {
        void notifyReservationConfirmed({
          reservationId: id,
          businessId: existing.businessId,
          businessName: existing.business.name,
          guestTelegramId: existing.guestTelegramId,
          tableName: existing.table.name,
          reservedAt: existing.reservedAt,
        });
      }
    }

    return { ok: true, status: "CONFIRMED" };
  } catch (e) {
    console.error("confirmTableReservationById:", e);
    return { ok: false, error: "UPDATE_FAILED" };
  }
}

export async function rejectTableReservationById(
  id: number,
): Promise<ReservationApprovalResult> {
  const existing = await loadPendingReservation(id);
  if (!existing) return { ok: false, error: "NOT_FOUND" };
  if (existing.status !== "PENDING") return { ok: false, error: "WRONG_STATUS" };

  try {
    await prisma.tableReservation.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    await syncDiningTableStatuses(existing.businessId);
    await cancelUnpaidPreordersForReservation(id, existing.businessId);

    if (existing.guestTelegramId) {
      void notifyReservationRejected({
        businessId: existing.businessId,
        guestTelegramId: existing.guestTelegramId,
      });
    }

    return { ok: true, status: "CANCELLED" };
  } catch (e) {
    console.error("rejectTableReservationById:", e);
    return { ok: false, error: "UPDATE_FAILED" };
  }
}
