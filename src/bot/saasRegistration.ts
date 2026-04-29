import type { Context } from "telegraf";
import type { Telegraf } from "telegraf";
import {
  BillingPlan,
  RegistrationStatus,
  SubscriptionStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "../server/db.js";
import { validateKgPhone } from "../server/orderInputSanitize.js";

type BotRole =
  | { type: "env"; botIndex: number }
  | { type: "dynamic"; businessId: number };

type WizardKind =
  | { kind: "want_name" }
  | { kind: "want_token"; name: string }
  | { kind: "want_phone"; name: string; botToken: string };

const wizardSessions = new Map<number, WizardKind>();

function readStartParam(ctx: Context): string | undefined {
  const msg = ctx.message;
  const text =
    typeof msg === "object" &&
    msg !== null &&
    "text" in msg &&
    typeof msg.text === "string"
      ? msg.text
      : undefined;
  if (typeof text === "string" && text.startsWith("/start ")) {
    return text.slice(7).trim() || undefined;
  }
  const p = ctx as { startParam?: string };
  if (typeof p.startParam === "string" && p.startParam.trim() !== "") {
    return p.startParam.trim();
  }
  return undefined;
}

function telegramIdString(ctx: Context): string {
  const id = ctx.from?.id;
  return id == null ? "" : String(id);
}

function normalizeStoreName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function adminTelegramNumericIds(): string[] {
  const raw = process.env.ADMIN_IDS;
  if (!raw) return [];
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

function parseCallbackId(prefix: string, data: string): number | null {
  const p = `${prefix}_`;
  if (!data.startsWith(p)) return null;
  const n = Number(data.slice(p.length));
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function tokenIsUnavailable(token: string): Promise<boolean> {
  const trimmed = token.trim();
  const inBusiness = await prisma.business.findUnique({
    where: { botToken: trimmed },
    select: { id: true },
  });
  if (inBusiness) return true;

  const pending = await prisma.registrationRequest.findFirst({
    where: {
      botToken: trimmed,
      status: RegistrationStatus.PENDING,
    },
    select: { id: true },
  });
  return pending != null;
}

async function validateBotToken(remoteToken: string): Promise<
  | { ok: true; username: string }
  | { ok: false }
> {
  const meRes = await fetch(
    `https://api.telegram.org/bot${encodeURIComponent(remoteToken.trim())}/getMe`
  );
  const meJson = (await meRes.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: { username?: string };
  };
  if (!meRes.ok || !meJson.ok || !meJson.result) {
    return { ok: false };
  }
  return { ok: true, username: String(meJson.result.username ?? "") };
}

function registrationMarkup(requestId: number) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Одобрить", callback_data: `rega_${requestId}` },
        { text: "❌ Отклонить", callback_data: `regr_${requestId}` },
      ],
    ],
  };
}

export function attachSaasRegistration(bot: Telegraf, role: BotRole): void {
  if (role.type !== "env" || role.botIndex !== 0) {
    return;
  }

  bot.use(async (ctx, next) => {
    try {
      if (handledWizardText(bot, ctx)) {
        return;
      }
      await next();
    } catch (e) {
      console.error("saasRegistration wizard middleware:", e);
      await next();
    }
  });
}

function handledWizardText(_bot: Telegraf, ctx: Context): boolean {
  const uid = ctx.from?.id;
  if (uid === undefined || ctx.chat?.type !== "private") return false;

  const st = wizardSessions.get(uid);
  const text =
    ctx.message !== undefined &&
    "text" in ctx.message &&
    typeof ctx.message.text === "string"
      ? ctx.message.text
      : null;
  if (text == null) return false;
  const clean = normalizeStoreName(text);
  if (!st) return false;

  if (st.kind === "want_name") {
    if (clean === "") {
      void ctx.reply("Название не может быть пустым.");
      return true;
    }
    wizardSessions.set(uid, {
      kind: "want_token",
      name: clean.slice(0, 160),
    });
    void ctx.reply(
      "Введите токен бота от @BotFather (выглядит как `123456:ABC...`):"
    );
    return true;
  }

  if (st.kind === "want_token") {
    void (async () => {
      const trimmed = clean.replace(/\s/g, "");
      if (trimmed.length < 30) {
        await ctx.reply("Токен слишком короткий. Вставьте полный токен бота.");
        return;
      }
      const v = await validateBotToken(trimmed);
      if (!v.ok) {
        await ctx.reply("Не удалось проверить токен через Telegram API. Вставьте корректный токен.");
        return;
      }
      const taken = await tokenIsUnavailable(trimmed);
      if (taken) {
        await ctx.reply("Этот токен уже используется другой заявкой или активным магазином.");
        return;
      }
      wizardSessions.set(uid, {
        kind: "want_phone",
        name: st.name,
        botToken: trimmed,
      });
      await ctx.reply(
        "Введите номер телефона (формат KG: +996XXXXXXXXX или 0XXXXXXXXX)."
      );
    })();
    return true;
  }

  if (st.kind === "want_phone") {
    void (async () => {
      const phone = clean.trim();
      if (!validateKgPhone(phone)) {
        await ctx.reply("Неверный формат номера. Пример: +996501234567");
        return;
      }
      try {
        const duplicate = await prisma.registrationRequest.findFirst({
          where: {
            telegramId: telegramIdString(ctx),
            status: RegistrationStatus.PENDING,
          },
        });
        if (duplicate) {
          await ctx.reply("У вас уже есть активная заявка на модерацию. Ожидайте решения администратора.");
          wizardSessions.delete(uid);
          return;
        }

        const row = await prisma.registrationRequest.create({
          data: {
            name: st.name,
            botToken: st.botToken,
            phone,
            telegramId: telegramIdString(ctx),
          },
        });

        wizardSessions.delete(uid);
        await ctx.reply(
          "Спасибо. Заявка отправлена администратору. После одобрения вы получите сообщение здесь же."
        );

        const admins = adminTelegramNumericIds();
        if (admins.length === 0) {
          console.error(
            "ADMIN_IDS не задан — некому отправить заявку на модерацию (saasRegistration)."
          );
          return;
        }

        const lines = [
          "📩 Новая заявка на магазин",
          `ID заявки: #${row.id}`,
          `Название: ${row.name}`,
          `Телефон: ${row.phone}`,
          `Telegram пользователя (id): ${row.telegramId}`,
        ];

        for (const aid of admins) {
          await _bot.telegram
            .sendMessage(aid, lines.join("\n"), {
              reply_markup: registrationMarkup(row.id),
            })
            .catch((e: unknown) => {
              console.error("notify admin:", aid, e);
            });
        }
      } catch (e: unknown) {
        console.error("registration save:", e);
        await ctx.reply("Не удалось сохранить заявку. Попробуйте позже.");
      }
    })();
    return true;
  }

  return false;
}

/**
 * Вызывается первым из `tgBot.start`: глубокая ссылка `…/start register`.
 */
export function tryBeginRegistrationFromDeepLink(role: BotRole, ctx: Context): boolean {
  if (role.type !== "env" || role.botIndex !== 0) return false;
  if (ctx.chat?.type !== "private") return false;
  const p = readStartParam(ctx)?.toLowerCase();
  if (p !== "register" && p !== "onboarding") return false;

  const uid = ctx.from?.id;
  if (uid === undefined) return false;

  wizardSessions.set(uid, { kind: "want_name" });
  void ctx.reply("Введите название магазина:");
  return true;
}

export async function handleRegistrationCallbacks(
  ctx: Context
): Promise<boolean> {
  if (!("callbackQuery" in ctx) || typeof ctx.callbackQuery !== "object" || ctx.callbackQuery === null || !("data" in ctx.callbackQuery)) return false;

  const data = ctx.callbackQuery.data;
  if (typeof data !== "string") return false;

  const appr = parseCallbackId("rega", data);
  const rej = parseCallbackId("regr", data);
  if (appr == null && rej == null) return false;

  const admins = adminTelegramNumericIds();
  const fromId = ctx.from?.id === undefined ? "" : String(ctx.from.id);

  if (!admins.includes(fromId)) {
    try {
      await ctx.answerCbQuery("Нет доступа");
    } catch {
      /* ignore */
    }
    return true;
  }

  await ctx.answerCbQuery().catch(() => undefined);

  if (rej != null) {
    await handleRejectFlow(ctx, rej);
    return true;
  }

  if (appr != null) {
    await handleApproveFlow(ctx, appr);
    return true;
  }

  return false;
}

async function handleRejectFlow(ctx: Context, requestId: number): Promise<void> {
  try {
    const row = await prisma.registrationRequest.findUnique({
      where: { id: requestId },
    });
    if (!row || row.status !== RegistrationStatus.PENDING) {
      await ctx.editMessageText("❌ Заявка уже обработана или не найдена.");
      return;
    }
    await prisma.registrationRequest.update({
      where: { id: row.id },
      data: { status: RegistrationStatus.REJECTED },
    });

    await ctx.editMessageText(`❌ Заявка #${requestId} отклонена.`, {
      reply_markup: { inline_keyboard: [] },
    });

    await ctx.telegram
      .sendMessage(
        row.telegramId,
        "Ваша заявка на регистрацию была отклонена администратором.\nПри необходимости свяжитесь с поддержкой."
      )
      .catch((e: unknown) => console.error("reject notify user:", e));
  } catch (e) {
    console.error("handleRejectFlow:", e);
  }
}

async function handleApproveFlow(ctx: Context, requestId: number): Promise<void> {
  try {
    const row = await prisma.registrationRequest.findUnique({
      where: { id: requestId },
    });
    if (!row || row.status !== RegistrationStatus.PENDING) {
      await ctx.editMessageText("❌ Заявка уже обработана или не найдена.");
      return;
    }

    const slug = `shop-${requestId}-${Date.now().toString(36)}`;
    const trialEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

    const bizInUse = await prisma.business.findUnique({
      where: { botToken: row.botToken.trim() },
    });
    if (bizInUse) {
      await ctx.editMessageText("⚠️ Этот токен уже привязан к активному Business.");
      await prisma.registrationRequest.update({
        where: { id: row.id },
        data: { status: "REJECTED" },
      });
      return;
    }

    let businessId!: number;

    await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: row.name,
          slug,
          botToken: row.botToken.trim(),
          isActive: true,
          subscriptionStatus: SubscriptionStatus.TRIALING,
          billingPlan: BillingPlan.FREE,
          trialEndsAt: trialEnd,
        },
      });

      await tx.settings.create({
        data: {
          businessId: business.id,
        },
      });

      await tx.user.create({
        data: {
          telegramId: row.telegramId,
          name: normalizeStoreName(row.name),
          businessId: business.id,
          role: UserRole.ADMIN,
        },
      });

      await tx.registrationRequest.update({
        where: { id: row.id },
        data: { status: "APPROVED" },
      });

      businessId = business.id;
    });

    const { registerDynamicUserBot } = await import("./bot.js");
    let botUsername = "";
    try {
      const r = await registerDynamicUserBot({
        businessId,
        botToken: row.botToken.trim(),
      });
      botUsername = r.username;
    } catch (e) {
      console.error("approve: registerDynamicUserBot:", e);
    }

    await ctx.editMessageText(
      `✅ Заявка #${requestId} одобрена.\n` +
        `Магазин businessId=${businessId}` +
        (botUsername !== "" ? `\n@${botUsername}` : ""),
      { reply_markup: { inline_keyboard: [] } }
    );

    const front = (process.env.FRONT_URL || process.env.PUBLIC_URL || "")
      .trim()
      .replace(/\/$/, "");
    const tgUrl =
      front !== ""
        ? `${front}/?shop=${encodeURIComponent(String(businessId))}`
        : undefined;

    if (tgUrl) {
      await ctx.telegram.sendMessage(row.telegramId, "Ваш магазин активирован ✅", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Открыть магазин", web_app: { url: tgUrl } }],
          ],
        },
      }).catch((e: unknown) => console.error("approved user ping:", e));
    } else {
      await ctx.telegram
        .sendMessage(
          row.telegramId,
          `Ваш магазин активирован ✅\n` +
            `shop=${businessId} (задайте FRONT_URL для кнопки мини-приложения)`
        )
        .catch((e: unknown) => console.error("approved user ping:", e));
    }
  } catch (e) {
    console.error("handleApproveFlow:", e);
    try {
      await ctx.editMessageText(
        "Ошибка создания Business. Посмотрите лог сервера."
      );
    } catch {
      /* ignore */
    }
  }
}
