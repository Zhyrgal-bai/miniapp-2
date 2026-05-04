import type { Context, MiddlewareFn } from "telegraf";
import type { Telegraf } from "telegraf";
import { prisma } from "../server/db.js";
import { syncBusinessSubscriptionActivationState } from "../server/saasBillingService.js";
import { businessSubscriptionBlocked } from "../middleware/business.middleware.js";
import {
  isTelegramCancelCommandText,
  isTelegramStartCommandText,
} from "./saasRegistration.js";

/** Оригинальный текст команд (для /start@Bot регистрозависимо в редких клиентах). */
function messageTextRaw(ctx: Context): string | null {
  const m = ctx.message;
  if (
    m === undefined ||
    m === null ||
    !("text" in m) ||
    typeof m.text !== "string"
  ) {
    return null;
  }
  return m.text.trim();
}

/**
 * После синхронизации сроков: при неактивной подписке в личке пропускаем только /start и /cancel
 * (вебхук при этом не вызывает handleUpdate — см. `relayDynamicStoreWebhook`).
 */
export function attachDynamicMerchantSubscriptionGate(
  tgBot: Telegraf<Context>,
  businessId: number,
): void {
  const gate: MiddlewareFn<Context> = async (ctx, next) => {
    await syncBusinessSubscriptionActivationState(businessId);

    const b = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        isActive: true,
        isBlocked: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
      },
    });

    if (b == null) {
      await next();
      return;
    }

    if (!businessSubscriptionBlocked(b)) {
      await next();
      return;
    }

    const priv = ctx.chat?.type === "private";

    const raw = messageTextRaw(ctx);

    /** /start и /cancel обязаны проходить — иначе бот «зависает» при просрочке. */
    const isStartOrCancel =
      raw !== null &&
      (isTelegramStartCommandText(raw) || isTelegramCancelCommandText(raw));

    if (priv && isStartOrCancel) {
      await next();
      return;
    }

    const reply = b.isBlocked
      ? "❌ Магазин отключён администратором"
      : "❌ Подписка не активна. Оплатите подписку в Mini App.";

    await ctx.reply(reply);
  };

  tgBot.use(gate);
}
