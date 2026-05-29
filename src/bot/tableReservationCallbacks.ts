import type { Context } from "telegraf";
import { prisma } from "../server/db.js";
import {
  confirmTableReservationById,
  rejectTableReservationById,
} from "../server/tableReservationApproval.js";
import { canApproveTableReservation } from "../server/tableReservationStaff.js";

export function parseTableReservationCallbackData(
  data: string,
): { action: "confirm" | "reject"; reservationId: number } | null {
  const confirmMatch = /^reservation_confirm_(\d+)$/.exec(data);
  if (confirmMatch) {
    const reservationId = Number(confirmMatch[1]);
    return Number.isFinite(reservationId) && reservationId > 0
      ? { action: "confirm", reservationId }
      : null;
  }
  const rejectMatch = /^reservation_reject_(\d+)$/.exec(data);
  if (rejectMatch) {
    const reservationId = Number(rejectMatch[1]);
    return Number.isFinite(reservationId) && reservationId > 0
      ? { action: "reject", reservationId }
      : null;
  }
  return null;
}

export async function handleTableReservationCallback(ctx: Context): Promise<boolean> {
  if (!("data" in ctx.callbackQuery!)) return false;
  const data = ctx.callbackQuery.data;
  if (!data) return false;

  const parsed = parseTableReservationCallbackData(data);
  if (!parsed) return false;

  const callerId = ctx.from?.id;
  if (!callerId) {
    await ctx.answerCbQuery("Нет доступа");
    return true;
  }

  const reservation = await prisma.tableReservation.findUnique({
    where: { id: parsed.reservationId },
    select: { businessId: true, status: true },
  });
  if (!reservation) {
    await ctx.answerCbQuery("Бронь не найдена");
    return true;
  }

  const authorized = await canApproveTableReservation(
    reservation.businessId,
    callerId,
  );
  if (!authorized) {
    await ctx.answerCbQuery("Нет доступа");
    return true;
  }

  if (reservation.status !== "PENDING") {
    await ctx.answerCbQuery("Бронь уже обработана");
    return true;
  }

  const result =
    parsed.action === "confirm"
      ? await confirmTableReservationById(parsed.reservationId)
      : await rejectTableReservationById(parsed.reservationId);

  if (!result.ok) {
    const msg =
      result.error === "WRONG_STATUS"
        ? "Бронь уже обработана"
        : result.error === "NOT_FOUND"
          ? "Бронь не найдена"
          : "Ошибка обработки";
    await ctx.answerCbQuery(msg);
    return true;
  }

  await ctx.answerCbQuery(
    parsed.action === "confirm" ? "✅ Подтверждено" : "❌ Отклонено",
  );

  const msg = ctx.callbackQuery.message;
  if (msg && "text" in msg && msg.message_id != null && msg.chat) {
    const suffix =
      parsed.action === "confirm" ? "\n\n✅ Подтверждено" : "\n\n❌ Отклонено";
    try {
      await ctx.telegram.editMessageText(
        msg.chat.id,
        msg.message_id,
        undefined,
        `${msg.text}${suffix}`,
        { reply_markup: { inline_keyboard: [] } },
      );
    } catch (e) {
      console.error("handleTableReservationCallback editMessage:", e);
    }
  }

  return true;
}
