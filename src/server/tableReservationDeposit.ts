import type { ReservationDepositStatus } from "@prisma/client";
import { prisma } from "./db.js";
import {
  createFinikReservationDepositSession,
  syncFinikReservationDepositPayment,
} from "./finikMerchant.js";
import {
  FINIK_LEGACY_HTTP_UNAVAILABLE_ERROR,
  canCreateFinikPayment,
  isFinikCredentialsReady,
} from "../shared/finikReady.js";
import {
  DEPOSIT_PAYMENT_TIMEOUT_MINUTES,
  parseReservationDepositSettings,
  reservationDepositExternalId,
  reservationDepositLabel,
  type ReservationDepositSettings,
} from "../shared/reservationDeposit.js";
import { cancelUnpaidPreordersForReservation } from "./tableReservationPreorder.js";
import {
  notifyReservationCancelled,
  notifyReservationConfirmedAfterDeposit,
  notifyReservationDepositRequired,
} from "./tableReservationNotify.js";
import { syncDiningTableStatuses } from "./tableReservationService.js";

export async function loadReservationDepositSettings(
  businessId: number,
): Promise<ReservationDepositSettings> {
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: { merchantConfig: true },
  });
  return parseReservationDepositSettings(b?.merchantConfig);
}

export function computeDepositDueAt(from = new Date()): Date {
  return new Date(from.getTime() + DEPOSIT_PAYMENT_TIMEOUT_MINUTES * 60_000);
}

/** Called on admin confirm when deposit is enabled for the business. */
export async function initReservationDepositOnConfirm(
  reservationId: number,
  settings: ReservationDepositSettings,
  now = new Date(),
): Promise<void> {
  if (!settings.enabled || settings.amountSom < 1) return;

  await prisma.tableReservation.update({
    where: { id: reservationId },
    data: {
      depositStatus: "DEPOSIT_PENDING",
      depositAmount: settings.amountSom,
      depositDueAt: computeDepositDueAt(now),
      depositPaidAt: null,
      depositPaymentId: null,
    },
  });
}

export async function applyReservationDepositPaid(
  reservationId: number,
  paymentId: string,
  now = new Date(),
): Promise<
  | { ok: true; duplicate: boolean }
  | { ok: false; error: string; statusCode: number }
> {
  const reservation = await prisma.tableReservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      businessId: true,
      status: true,
      depositStatus: true,
      depositAmount: true,
      guestTelegramId: true,
      reservedAt: true,
      table: { select: { name: true } },
      business: { select: { name: true } },
    },
  });

  if (!reservation) {
    return { ok: false, statusCode: 404, error: "Reservation not found" };
  }
  if (reservation.status !== "CONFIRMED") {
    return { ok: false, statusCode: 409, error: "Reservation not active" };
  }
  if (reservation.depositStatus === "DEPOSIT_PAID") {
    return { ok: true, duplicate: true };
  }
  if (reservation.depositStatus !== "DEPOSIT_PENDING") {
    return { ok: false, statusCode: 409, error: "Deposit not pending" };
  }

  await prisma.tableReservation.update({
    where: { id: reservationId },
    data: {
      depositStatus: "DEPOSIT_PAID",
      depositPaidAt: now,
      depositPaymentId: paymentId,
      depositDueAt: null,
    },
  });

  if (reservation.guestTelegramId) {
    void notifyReservationConfirmedAfterDeposit({
      reservationId: reservation.id,
      businessId: reservation.businessId,
      businessName: reservation.business.name,
      guestTelegramId: reservation.guestTelegramId,
      tableName: reservation.table.name,
      reservedAt: reservation.reservedAt,
    });
  }

  return { ok: true, duplicate: false };
}

export async function startReservationDepositPayment(input: {
  businessId: number;
  reservationId: number;
  guestTelegramId: string;
}): Promise<
  | { ok: true; paymentUrl: string; paymentId: string; amountSom: number }
  | { ok: false; error: string; status: number }
> {
  const reservation = await prisma.tableReservation.findFirst({
    where: {
      id: input.reservationId,
      businessId: input.businessId,
      guestTelegramId: input.guestTelegramId,
    },
    select: {
      id: true,
      status: true,
      depositStatus: true,
      depositAmount: true,
      depositPaymentId: true,
    },
  });

  if (!reservation) {
    return { ok: false, status: 404, error: "Бронь не найдена" };
  }
  if (reservation.status !== "CONFIRMED") {
    return { ok: false, status: 409, error: "Бронь ещё не подтверждена" };
  }
  if (reservation.depositStatus !== "DEPOSIT_PENDING") {
    return { ok: false, status: 409, error: "Депозит не требует оплаты" };
  }
  const amountSom = reservation.depositAmount ?? 0;
  if (amountSom < 1) {
    return { ok: false, status: 409, error: "Сумма депозита не задана" };
  }

  const business = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: {
      id: true,
      finikApiKey: true,
      finikAccountId: true,
      finikSecret: true,
    },
  });
  if (!business) {
    return { ok: false, status: 404, error: "Магазин не найден" };
  }

  if (
    isFinikCredentialsReady(business.finikApiKey, business.finikAccountId) &&
    !canCreateFinikPayment(business)
  ) {
    return { ok: false, status: 503, error: FINIK_LEGACY_HTTP_UNAVAILABLE_ERROR };
  }

  const finik = await createFinikReservationDepositSession(business, {
    reservationId: reservation.id,
    amountSom,
  });
  if (!finik.ok) {
    return { ok: false, status: 502, error: finik.error };
  }

  await prisma.tableReservation.update({
    where: { id: reservation.id },
    data: { depositPaymentId: finik.paymentId },
  });

  return {
    ok: true,
    paymentUrl: finik.paymentUrl,
    paymentId: finik.paymentId,
    amountSom,
  };
}

export async function syncGuestReservationDepositPayment(input: {
  businessId: number;
  reservationId: number;
  guestTelegramId: string;
}) {
  const reservation = await prisma.tableReservation.findFirst({
    where: {
      id: input.reservationId,
      businessId: input.businessId,
      guestTelegramId: input.guestTelegramId,
    },
    select: { id: true, depositPaymentId: true, depositStatus: true },
  });
  if (!reservation?.depositPaymentId?.trim()) {
    return { ok: false as const, status: 400, error: "Нет платежа Finik" };
  }
  if (reservation.depositStatus === "DEPOSIT_PAID") {
    return { ok: true as const, paymentState: "paid" as const, duplicate: true };
  }

  return syncFinikReservationDepositPayment(
    reservation.id,
    input.businessId,
    reservation.depositPaymentId,
  ).then((r) =>
    !r.ok ? { ok: false as const, status: r.statusCode, error: r.error } : r,
  );
}

export async function expireStaleReservationDepositesOnce(
  now = new Date(),
): Promise<number> {
  const due = await prisma.tableReservation.findMany({
    where: {
      status: "CONFIRMED",
      depositStatus: "DEPOSIT_PENDING",
      depositDueAt: { lte: now },
    },
    include: {
      table: { select: { name: true } },
      business: { select: { name: true } },
    },
    take: 50,
  });

  for (const row of due) {
    await prisma.tableReservation.update({
      where: { id: row.id },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        depositStatus: "DEPOSIT_EXPIRED",
        depositDueAt: null,
      },
    });
    await syncDiningTableStatuses(row.businessId);
    await cancelUnpaidPreordersForReservation(row.id, row.businessId);

    if (row.guestTelegramId) {
      void notifyReservationCancelled({
        businessId: row.businessId,
        businessName: row.business.name,
        guestTelegramId: row.guestTelegramId,
        tableName: row.table.name,
        reservedAt: row.reservedAt,
      });
    }
  }

  return due.length;
}

export function reservationDepositDtoFields(row: {
  depositStatus: ReservationDepositStatus;
  depositAmount: number | null;
  depositPaidAt: Date | null;
  depositDueAt: Date | null;
}) {
  return {
    depositStatus: row.depositStatus,
    depositAmount: row.depositAmount,
    depositPaidAt: row.depositPaidAt?.toISOString() ?? null,
    depositDueAt: row.depositDueAt?.toISOString() ?? null,
    depositLabel: reservationDepositLabel(row.depositStatus),
    canPayDeposit: row.depositStatus === "DEPOSIT_PENDING",
  };
}

export { reservationDepositExternalId };
