import type { Context } from "telegraf";
import { prisma } from "../server/db.js";
import {
  acceptWaitlistInvite,
  declineWaitlistInvite,
} from "../server/tableReservationWaitlistService.js";

export function parseWaitlistCallbackData(
  data: string,
): { action: "accept" | "decline"; entryId: number } | null {
  const acceptMatch = /^waitlist_accept_(\d+)$/.exec(data);
  if (acceptMatch) {
    const entryId = Number(acceptMatch[1]);
    return Number.isFinite(entryId) && entryId > 0
      ? { action: "accept", entryId }
      : null;
  }
  const declineMatch = /^waitlist_decline_(\d+)$/.exec(data);
  if (declineMatch) {
    const entryId = Number(declineMatch[1]);
    return Number.isFinite(entryId) && entryId > 0
      ? { action: "decline", entryId }
      : null;
  }
  return null;
}

export async function handleWaitlistCallback(ctx: Context): Promise<boolean> {
  if (!("data" in ctx.callbackQuery!)) return false;
  const data = ctx.callbackQuery.data;
  if (!data) return false;

  const parsed = parseWaitlistCallbackData(data);
  if (!parsed) return false;

  const callerId = ctx.from?.id;
  if (!callerId) {
    await ctx.answerCbQuery("Нет доступа");
    return true;
  }

  const entry = await prisma.waitlistEntry.findUnique({
    where: { id: parsed.entryId },
    select: { guestTelegramId: true, status: true },
  });
  if (!entry) {
    await ctx.answerCbQuery("Приглашение не найдено");
    return true;
  }
  if (entry.guestTelegramId?.trim() !== String(callerId)) {
    await ctx.answerCbQuery("Нет доступа");
    return true;
  }
  if (entry.status !== "INVITED") {
    await ctx.answerCbQuery("Приглашение уже обработано");
    return true;
  }

  const result =
    parsed.action === "accept"
      ? await acceptWaitlistInvite(parsed.entryId, String(callerId))
      : await declineWaitlistInvite(parsed.entryId, String(callerId));

  if (!result.ok) {
    await ctx.answerCbQuery(
      "error" in result ? result.error : "Ошибка обработки",
    );
    return true;
  }

  await ctx.answerCbQuery(
    parsed.action === "accept" ? "✅ Столик ваш!" : "Отказ принят",
  );

  const msg = ctx.callbackQuery.message;
  if (msg && "text" in msg && msg.message_id != null && msg.chat) {
    const suffix =
      parsed.action === "accept"
        ? "\n\n✅ Столик забронирован"
        : "\n\n❌ Отказ";
    try {
      await ctx.telegram.editMessageText(
        msg.chat.id,
        msg.message_id,
        undefined,
        `${msg.text}${suffix}`,
        { reply_markup: { inline_keyboard: [] } },
      );
    } catch (e) {
      console.error("handleWaitlistCallback editMessage:", e);
    }
  }

  return true;
}
