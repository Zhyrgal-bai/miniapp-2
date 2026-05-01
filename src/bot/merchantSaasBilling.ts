import type { Telegraf } from "telegraf";
import type { Context } from "telegraf";
import { MembershipRole } from "@prisma/client";
import {
  SAAS_SUBSCRIPTION_PRICE_20_D,
  SAAS_SUBSCRIPTION_PRICE_30_D,
  createSaasPaymentRequestFromMerchantPhoto,
} from "../server/saasBillingService.js";

type TenantTelegrafCtx = Context & {
  tenantRole?: MembershipRole | null;
  businessId?: number;
};

function isMerchantTenantRole(role: MembershipRole | null | undefined): boolean {
  return role === MembershipRole.OWNER || role === MembershipRole.ADMIN;
}

const PAY_REPLY =
  `💰 Оплата магазина\n\n` +
  `20 дней — ${SAAS_SUBSCRIPTION_PRICE_20_D} сом\n` +
  `30 дней — ${SAAS_SUBSCRIPTION_PRICE_30_D} сом\n\n` +
  `Отправьте чек после оплаты (в подписи к фото можно указать ${SAAS_SUBSCRIPTION_PRICE_20_D} или ${SAAS_SUBSCRIPTION_PRICE_30_D}).`;

/**
 * Экран оплаты подписки SaaS для владельца/админа магазина в клиентском боте тенанта.
 */
export function attachMerchantSaasBillingCommands(
  tgBot: Telegraf,
  businessId: number,
): void {
  tgBot.command("pay", async (ctx) => {
    const cx = ctx as TenantTelegrafCtx;
    if (ctx.chat?.type !== "private") return;
    if (!isMerchantTenantRole(cx.tenantRole ?? null)) {
      await ctx.reply("Раздел оплаты магазина доступен только владельцу.");
      return;
    }
    await ctx.reply(PAY_REPLY);
  });

  tgBot.on("photo", async (ctx, next) => {
    const cx = ctx as TenantTelegrafCtx;
    if (ctx.chat?.type !== "private") {
      return next();
    }
    if (!isMerchantTenantRole(cx.tenantRole ?? null)) {
      return next();
    }

    const msg = ctx.message;
    const photos =
      msg != null && "photo" in msg && Array.isArray(msg.photo)
        ? msg.photo
        : [];
    const last = photos[photos.length - 1];
    if (last?.file_id == null) return next();

    const tokenEnv = tgBot.telegram.token.trim();
    if (!tokenEnv) return next();

    const caption =
      msg != null && "caption" in msg && typeof msg.caption === "string"
        ? msg.caption
        : undefined;

    const created = await createSaasPaymentRequestFromMerchantPhoto({
      businessId,
      botToken: tokenEnv,
      largestFileId: last.file_id,
      ...(caption !== undefined ? { caption } : {}),
    });

    if (created.ok) {
      await ctx.reply(
        `Чек принят ✅ Заявка #${created.id}. Ожидайте подтверждения платформы.`,
      );
      return;
    }
    await ctx.reply(created.error);
  });
}
