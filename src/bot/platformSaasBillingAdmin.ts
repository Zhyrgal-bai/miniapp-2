import type { Context } from "telegraf";
import type { Telegraf } from "telegraf";
import {
  adminApproveSaasPayment,
  adminBlockBusiness,
  adminRejectSaasPayment,
  adminUnblockBusiness,
} from "../server/saasBillingService.js";

export type EnvBotRole =
  | { type: "env"; botIndex: number }
  | { type: "dynamic"; businessId: number };

function rawPlatformAdminTelegramIds(): string[] {
  const raw = process.env.ADMIN_IDS ?? "";
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

function ctxIsPlatformAdmin(ctx: Context): boolean {
  const id = ctx.from?.id;
  if (id == null) return false;
  const ids = rawPlatformAdminTelegramIds();
  if (ids.length === 0) return false;
  const sid = String(id);
  return ids.some((x) => x === sid || Number(x) === id);
}

/**
 * Ручное управление подписками и блокировкой через первый платформенный бот (`BOT_TOKEN`).
 */
export function attachPlatformSaasBillingAdmin(
  tgBot: Telegraf,
  role: EnvBotRole,
): void {
  if (role.type !== "env" || role.botIndex !== 0) return;

  tgBot.use(async (ctx, next) => {
    if (ctx.chat?.type !== "private") {
      await next();
      return;
    }

    const msg = ctx.message;
    const rawText =
      msg != null && "text" in msg && typeof msg.text === "string"
        ? msg.text.trim()
        : "";

    if (!/^\/admin_(?:block|unblock|approve|reject)(?:@\w+)?(?:\s|$)/i.test(
      rawText,
    )) {
      await next();
      return;
    }

    if (!ctxIsPlatformAdmin(ctx)) {
      await ctx.reply("Команда только для платформенного админа (ADMIN_IDS).");
      return;
    }

    const blockMatch = rawText.match(
      /^\/admin_block(?:@\w+)?\s+(\d+)\s*$/i,
    );
    const unblockMatch = rawText.match(
      /^\/admin_unblock(?:@\w+)?\s+(\d+)\s*$/i,
    );
    const approveMatch = rawText.match(
      /^\/admin_approve(?:@\w+)?\s+(\d+)(?:\s+(1500|5500))?\s*$/i,
    );
    const rejectMatch = rawText.match(/^\/admin_reject(?:@\w+)?\s+(\d+)\s*$/i);

    try {
      if (blockMatch) {
        await adminBlockBusiness(Number(blockMatch[1]));
        await ctx.reply(`Магазин ${blockMatch[1]} заблокирован 🔒`);
        return;
      }
      if (unblockMatch) {
        await adminUnblockBusiness(Number(unblockMatch[1]));
        await ctx.reply(`Магазин ${unblockMatch[1]} разблокирован ✅`);
        return;
      }
      if (approveMatch) {
        const pid = Number(approveMatch[1]);
        const forced = approveMatch[2] != null ? Number(approveMatch[2]) : undefined;
        const r = await adminApproveSaasPayment(pid, forced);
        if (!r.ok) {
          await ctx.reply(`⚠️ ${r.error}`);
          return;
        }
        await ctx.reply(`Платёж #${pid} одобрен ✅`);
        return;
      }
      if (rejectMatch) {
        const pid = Number(rejectMatch[1]);
        const r = await adminRejectSaasPayment(pid);
        if (!r.ok) {
          await ctx.reply(`⚠️ ${r.error}`);
          return;
        }
        await ctx.reply(`Платёж #${pid} отклонён`);
        return;
      }

      await ctx.reply(
        "Примеры:\n/admin_block 12\n/admin_unblock 12\n/admin_approve 5\n/admin_approve 5 1500\n/admin_reject 5",
      );
    } catch (e) {
      console.error("[platformSaasBillingAdmin]", e);
      await ctx.reply(e instanceof Error ? e.message : "Ошибка");
    }
  });
}
