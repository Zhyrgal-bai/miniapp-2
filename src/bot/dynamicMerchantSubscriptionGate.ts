import type { Context, MiddlewareFn } from "telegraf";
import { MembershipRole } from "@prisma/client";
import type { Telegraf } from "telegraf";
import { prisma } from "../server/db.js";
import { syncBusinessSubscriptionActivationState } from "../server/saasBillingService.js";
import { businessSubscriptionBlocked } from "../middleware/business.middleware.js";

type TenantTelegrafCtx = Context & {
  tenantRole?: MembershipRole | null;
  businessId?: number;
};

function isMerchant(role: MembershipRole | null | undefined): boolean {
  return role === MembershipRole.OWNER || role === MembershipRole.ADMIN;
}

function messageTextNormalized(ctx: Context): string | null {
  const m = ctx.message;
  if (
    m === undefined ||
    m === null ||
    !("text" in m) ||
    typeof m.text !== "string"
  ) {
    return null;
  }
  return m.text.trim().toLowerCase();
}

function messageHasPhoto(ctx: Context): boolean {
  const m = ctx.message;
  if (
    m === undefined ||
    m === null ||
    !("photo" in m) ||
    !Array.isArray((m as { photo?: unknown }).photo)
  ) {
    return false;
  }
  return (
    Array.isArray((m as { photo: unknown[] }).photo) &&
    (m as { photo: unknown[] }).photo.length > 0
  );
}

/**
 * После синхронизации `isActive` по срокам: блокируем бота, кроме /pay и фото‑чека
 * для владельца/админа в личке.
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

    const cx = ctx as TenantTelegrafCtx;
    const mr = isMerchant(cx.tenantRole ?? null);
    const priv = ctx.chat?.type === "private";

    const text = messageTextNormalized(ctx);
    const isPay =
      text !== null &&
      (text.startsWith("/pay ") || text === "/pay" || /^\/pay@/.test(text));

    const hasPhoto = messageHasPhoto(ctx);

    if (priv && mr && (isPay || hasPhoto)) {
      await next();
      return;
    }

    const reply = b.isBlocked
      ? "❌ Магазин отключён администратором"
      : "❌ Подписка закончилась.\n\nВведите /pay для оплаты.";

    await ctx.reply(reply);
  };

  tgBot.use(gate);
}
