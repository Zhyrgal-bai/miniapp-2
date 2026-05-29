import { prisma } from "./db.js";
import { REMINDER_LEAD_MINUTES } from "../shared/tableReservation.js";
import { notifyReservationReminder } from "./tableReservationNotify.js";
import { syncDiningTableStatuses } from "./tableReservationService.js";
import { runReservationPreorderKitchenSchedulerOnce } from "./reservationPreorderKitchenScheduler.js";
import { expireStaleReservationDepositesOnce } from "./tableReservationDeposit.js";
import { expireStaleWaitlistInvitesOnce } from "./tableReservationWaitlistService.js";

const TICK_MS = 5 * 60 * 1000;

export async function runTableReservationMaintenanceOnce(): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now.getTime() + (REMINDER_LEAD_MINUTES - 5) * 60_000);
  const windowEnd = new Date(now.getTime() + (REMINDER_LEAD_MINUTES + 5) * 60_000);

  const due = await prisma.tableReservation.findMany({
    where: {
      status: "CONFIRMED",
      reminderSentAt: null,
      guestTelegramId: { not: null },
      reservedAt: { gte: windowStart, lte: windowEnd },
    },
    include: {
      business: { select: { id: true, name: true } },
      table: { select: { name: true } },
    },
    take: 50,
  });

  for (const r of due) {
    const tg = r.guestTelegramId?.trim();
    if (!tg) continue;
    await notifyReservationReminder({
      businessId: r.businessId,
      businessName: r.business.name,
      guestTelegramId: tg,
      tableName: r.table.name,
      reservedAt: r.reservedAt,
    });
    await prisma.tableReservation.update({
      where: { id: r.id },
      data: { reminderSentAt: now },
    });
  }

  const businessIds = await prisma.tableReservation.findMany({
    where: {
      status: { in: ["PENDING", "CONFIRMED", "ARRIVED"] },
      reservedAt: { gte: new Date(now.getTime() - 24 * 60 * 60_000) },
    },
    select: { businessId: true },
    distinct: ["businessId"],
  });

  for (const row of businessIds) {
    try {
      await syncDiningTableStatuses(row.businessId);
    } catch (e) {
      console.error("syncDiningTableStatuses:", row.businessId, e);
    }
  }

  try {
    const expiredDeposits = await expireStaleReservationDepositesOnce(now);
    if (expiredDeposits > 0) {
      console.log(`reservationDeposit: expired ${expiredDeposits} unpaid deposits`);
    }
  } catch (e) {
    console.error("expireStaleReservationDeposites:", e);
  }

  try {
    const expiredWaitlist = await expireStaleWaitlistInvitesOnce(now);
    if (expiredWaitlist > 0) {
      console.log(`waitlist: expired ${expiredWaitlist} invites`);
    }
  } catch (e) {
    console.error("expireStaleWaitlistInvites:", e);
  }

  try {
    const promoted = await runReservationPreorderKitchenSchedulerOnce(now);
    if (promoted > 0) {
      console.log(`reservationPreorderKitchen: promoted ${promoted} to READY_FOR_PREP`);
    }
  } catch (e) {
    console.error("reservationPreorderKitchenScheduler:", e);
  }
}

export function startTableReservationScheduler(): void {
  void runTableReservationMaintenanceOnce().catch((e) =>
    console.error("tableReservationMaintenance initial:", e),
  );
  setInterval(() => {
    void runTableReservationMaintenanceOnce().catch((e) =>
      console.error("tableReservationMaintenance tick:", e),
    );
  }, TICK_MS);
  console.log("tableReservationMaintenance: every 5 min");
}
