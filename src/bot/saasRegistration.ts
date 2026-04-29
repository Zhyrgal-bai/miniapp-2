import type { Context } from "telegraf";
import { session } from "telegraf";
import type { Telegraf } from "telegraf";
import {
  BillingPlan,
  RegistrationStatus,
  SubscriptionStatus,
  UserRole,
} from "@prisma/client";
import { logPrismaError, prisma } from "../server/db.js";
import {
  isValidBotTokenShape,
  isValidStoreName,
  validateKgPhone,
} from "./saasRegistrationValidation.js";

type BotRole =
  | { type: "env"; botIndex: number }
  | { type: "dynamic"; businessId: number };

const REGISTRATION_COOLDOWN_MS = 10_000;

/**
 * Состояние онбординга в `ctx.session` (ключ сессии = пользователь в private).
 * Telegraf 4: `import { session } from "telegraf"` (не `telegraf/session`).
 */
export type RegistrationSessionState = {
  step?: "name" | "token" | "phone";
  /** ms epoch — ограничение частых повторных входов в мастер (/start register) */
  lastAttemptAt?: number;
  data: {
    name?: string;
    token?: string;
    phone?: string;
  };
};

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

function getRegistrationSession(ctx: Context): RegistrationSessionState | undefined {
  if (!("session" in ctx)) return undefined;
  const s = (ctx as { session?: RegistrationSessionState }).session;
  if (!s) return undefined;
  if (!s.data || typeof s.data !== "object") s.data = {};
  return s;
}

/** После успешной отправки заявки: только шаг и данные (cooldown сохраняется). */
function resetRegistrationWizardFields(ctx: Context): void {
  const sess = getRegistrationSession(ctx);
  if (!sess) return;
  delete sess.step;
  sess.data = {};
}

function logSaas(
  event: "registration_started" | "registration_completed" | "rejected_attempt",
  meta: Record<string, unknown>
): void {
  console.log(`[saasRegistration] ${event}`, meta);
}

function logStartHandlerError(err: unknown, label: string): void {
  logPrismaError(`saasRegistration:${label}`, err);
}

/** Один аккаунт User с магазином (telegramId может быть не уникальным между tenant — берём первую запись). */
async function findUserWithBusinessForTelegram(telegramId: string) {
  return prisma.user.findFirst({
    where: { telegramId },
    include: { business: true },
  });
}

async function replyMerchantAlreadyHasShop(
  ctx: Context,
  businessId: number
): Promise<void> {
  const text = "У вас уже есть магазин 🏪";
  const rawFront = (
    process.env.FRONTEND_URL ||
    process.env.FRONT_URL ||
    process.env.PUBLIC_URL ||
    ""
  ).trim();

  if (rawFront === "") {
    console.error(
      "[saasRegistration] FRONTEND_URL / FRONT_URL / PUBLIC_URL отсутствуют — кнопка Mini App недоступна"
    );
    await ctx.reply("Ошибка конфигурации сервера. Задайте FRONTEND_URL в переменных окружения.");
    return;
  }

  const base = rawFront.replace(/\/$/, "");
  const bid = Number(businessId);
  if (!Number.isFinite(bid) || bid <= 0) {
    console.error("[saasRegistration] invalid business id for merchant reply:", businessId);
    await ctx.reply("Ошибка данных магазина.");
    return;
  }

  const q = encodeURIComponent(String(bid));
  const storeUrl = `${base}/?shop=${q}`;
  const ordersUrl = `${base}/?shop=${q}&view=my-orders`;

  await ctx.reply(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Открыть магазин", web_app: { url: storeUrl } }],
        [{ text: "Мои заказы", web_app: { url: ordersUrl } }],
      ],
    },
  });
}

async function hasPendingRegistrationForTelegram(
  telegramId: string
): Promise<boolean> {
  const p = await prisma.registrationRequest.findFirst({
    where: {
      telegramId,
      status: RegistrationStatus.PENDING,
    },
    select: { id: true },
  });
  return p != null;
}

async function businessHasBotToken(token: string): Promise<boolean> {
  const b = await prisma.business.findUnique({
    where: { botToken: token.trim() },
    select: { id: true },
  });
  return b != null;
}

/** Токен занят активным Business или ожидающей заявкой. */
async function tokenIsUnavailableForNewRequest(
  token: string
): Promise<"business" | "pending" | null> {
  const trimmed = token.trim();
  if (await businessHasBotToken(trimmed)) return "business";
  const pending = await prisma.registrationRequest.findFirst({
    where: {
      botToken: trimmed,
      status: RegistrationStatus.PENDING,
    },
    select: { id: true },
  });
  if (pending) return "pending";
  return null;
}

async function verifyTokenWithTelegram(
  remoteToken: string
): Promise<{ ok: true; username: string } | { ok: false }> {
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

  bot.use(
    session({
      defaultSession: (): RegistrationSessionState => ({
        data: {},
      }),
      getSessionKey: (ctx) =>
        ctx.chat?.type === "private" && ctx.from != null
          ? `saas_reg:${ctx.from.id}`
          : undefined,
    })
  );

  bot.use(async (ctx, next) => {
    try {
      const sess = getRegistrationSession(ctx);
      if (!sess?.step) {
        await next();
        return;
      }
      if (await registrationFlow(bot, ctx)) {
        return;
      }
      await next();
    } catch (e) {
      console.error("saasRegistration middleware:", e);
      await next();
    }
  });
}

/**
 * Пошаговая регистрация SaaS (имя → токен → телефон).
 * Возвращает `true`, если сообщение обработано (мастер активен или шаг выполнен).
 */
export async function registrationFlow(
  _bot: Telegraf,
  ctx: Context
): Promise<boolean> {
  const uid = ctx.from?.id;
  if (uid === undefined || ctx.chat?.type !== "private") return false;

  const sess = getRegistrationSession(ctx);
  if (!sess) return false;

  const rawText =
    ctx.message !== undefined &&
    "text" in ctx.message &&
    typeof ctx.message.text === "string"
      ? ctx.message.text
      : null;
  if (rawText === null) return false;

  const trimmedInput = rawText.trim();
  /** Повторный /start в мастере — отдаём команду общему `bot.start()`, чтобы ответить «уже регистрируетесь». */
  if (
    sess.step !== undefined &&
    (trimmedInput === "/start" || trimmedInput.startsWith("/start "))
  ) {
    return false;
  }

  if (trimmedInput === "") {
    await ctx.reply("Пожалуйста, введите непустой текст.");
    return true;
  }

  const clean = normalizeStoreName(trimmedInput);

  // Нет активного шага — не перехватываем обычный чат (заказы и т.д.)
  if (sess.step === undefined) {
    return false;
  }

  if (sess.step === "name") {
    if (!isValidStoreName(clean)) {
      await ctx.reply(
        "Введите название магазина (от 2 до 160 символов, не только пробелы)."
      );
      return true;
    }
    sess.data.name = clean.slice(0, 160);
    sess.step = "token";
    await ctx.reply(
      "Введите токен бота от @BotFather (выглядит как `123456:ABC...`):"
    );
    return true;
  }

  if (sess.step === "token") {
    const tokenTrimmed = clean.replace(/\s/g, "");
    if (!isValidBotTokenShape(tokenTrimmed)) {
      await ctx.reply(
        "Неверный формат токена. Вставьте полный токен от @BotFather (без пробелов)."
      );
      return true;
    }
    const v = await verifyTokenWithTelegram(tokenTrimmed);
    if (!v.ok) {
      await ctx.reply(
        "Не удалось проверить токен через Telegram API. Вставьте корректный токен."
      );
      return true;
    }
    const tokenBlock = await tokenIsUnavailableForNewRequest(tokenTrimmed);
    if (tokenBlock === "business") {
      await ctx.reply("Этот бот уже используется");
      logSaas("rejected_attempt", {
        reason: "token_duplicate_business",
        telegramUserId: telegramIdString(ctx),
      });
      return true;
    }
    if (tokenBlock === "pending") {
      await ctx.reply(
        "Этот токен уже указан в другой заявке на рассмотрении."
      );
      logSaas("rejected_attempt", {
        reason: "token_duplicate_pending_request",
        telegramUserId: telegramIdString(ctx),
      });
      return true;
    }
    sess.data.token = tokenTrimmed;
    sess.step = "phone";
    await ctx.reply(
      "Введите номер телефона (формат KG: +996XXXXXXXXX или 0XXXXXXXXX)."
    );
    return true;
  }

  if (sess.step === "phone") {
    const phone = clean.trim();
    if (!validateKgPhone(phone)) {
      await ctx.reply(
        "Неверный формат номера. Пример: +996501234567 или 0700123456"
      );
      return true;
    }
    sess.data.phone = phone;

    const name = sess.data.name ?? "";
    const token = sess.data.token ?? "";

    try {
      const tid = telegramIdString(ctx);
      const existingUser = await findUserWithBusinessForTelegram(tid);
      if (existingUser?.business) {
        await replyMerchantAlreadyHasShop(ctx, existingUser.business.id);
        resetRegistrationWizardFields(ctx);
        logSaas("rejected_attempt", {
          reason: "already_has_business_at_submit",
          telegramUserId: tid,
        });
        return true;
      }

      const duplicate = await prisma.registrationRequest.findFirst({
        where: {
          telegramId: tid,
          status: RegistrationStatus.PENDING,
        },
        select: { id: true },
      });
      if (duplicate) {
        await ctx.reply(
          "У вас уже есть активная заявка на модерацию. Ожидайте решения администратора."
        );
        resetRegistrationWizardFields(ctx);
        logSaas("rejected_attempt", {
          reason: "duplicate_pending_at_submit",
          telegramUserId: telegramIdString(ctx),
        });
        return true;
      }

      if (name === "" || token === "") {
        resetRegistrationWizardFields(ctx);
        await ctx.reply("Сессия устарела. Начните снова: /start");
        logSaas("rejected_attempt", {
          reason: "stale_session_submit",
          telegramUserId: telegramIdString(ctx),
        });
        return true;
      }

      const row = await prisma.registrationRequest.create({
        data: {
          name,
          botToken: token,
          phone,
          telegramId: telegramIdString(ctx),
        },
      });

      resetRegistrationWizardFields(ctx);
      logSaas("registration_completed", {
        telegramUserId: telegramIdString(ctx),
        requestId: row.id,
      });

      await ctx.reply(
        "Заявка отправлена ✅\n\n" +
          "Название: " +
          name +
          "\n" +
          "Телефон: " +
          phone
      );

      const admins = adminTelegramNumericIds();
      if (admins.length === 0) {
        console.error(
          "ADMIN_IDS не задан — некому отправить заявку на модерацию (saasRegistration)."
        );
        return true;
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
      logSaas("rejected_attempt", {
        reason: "save_error",
        telegramUserId: telegramIdString(ctx),
      });
      await ctx.reply("Не удалось сохранить заявку. Попробуйте позже.");
    }
    return true;
  }

  return false;
}

/**
 * Первый бот (BOT_TOKENS[0]): любой `/start`, кроме `shop_*`, начинает онбординг SaaS.
 * Возвращает `false`, если передать нужно следующему коду (`shop_*` для веб-приложения).
 */
export async function handleRegistrationStartCommand(
  role: BotRole,
  ctx: Context
): Promise<boolean> {
  if (role.type !== "env" || role.botIndex !== 0) return false;
  if (ctx.chat?.type !== "private") return false;

  const raw = readStartParam(ctx)?.toLowerCase() ?? "";
  if (raw.startsWith("shop_")) {
    return false;
  }

  try {
    const fromId = ctx.from?.id;
    if (fromId === undefined || fromId === null) {
      await ctx.reply("Ошибка пользователя ❌ Не удалось определить Telegram ID.");
      return true;
    }

    const telegramIdStr = telegramIdString(ctx);

    let sess = getRegistrationSession(ctx);
    if (!sess && "session" in ctx) {
      (ctx as { session: RegistrationSessionState }).session = {
        data: {},
      };
      sess = getRegistrationSession(ctx);
    }

    if (!sess) {
      console.error("[saasRegistration] /start: session missing for private DM", {
        telegramUserId: telegramIdStr,
      });
      await ctx.reply("Ошибка сессии. Закройте чат и нажмите /start ещё раз.");
      return true;
    }

    if (sess.step) {
      await ctx.reply("Вы уже проходите регистрацию.");
      return true;
    }

    const now = Date.now();

    if (
      sess.lastAttemptAt != null &&
      now - sess.lastAttemptAt < REGISTRATION_COOLDOWN_MS
    ) {
      await ctx.reply(
        "Подождите 10 секунд перед следующей попыткой регистрации."
      );
      logSaas("rejected_attempt", {
        reason: "rate_limit_register_start",
        telegramUserId: telegramIdStr,
      });
      return true;
    }

    let userWithBiz: Awaited<
      ReturnType<typeof findUserWithBusinessForTelegram>
    >;
    try {
      userWithBiz = await findUserWithBusinessForTelegram(telegramIdStr);
    } catch (dbErr: unknown) {
      logStartHandlerError(dbErr, "/start DB: findUserWithBusiness failed");
      await ctx.reply(
        "Не удалось подключиться к базе данных. Проверьте DATABASE_URL на сервере (Render: Postgres должен быть доступен; часто нужен sslmode=require)."
      );
      return true;
    }

    if (userWithBiz?.business) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[saasRegistration] /start: existing merchant", {
          businessId: userWithBiz.business.id,
          telegramUserId: telegramIdStr,
        });
      }
      await replyMerchantAlreadyHasShop(ctx, userWithBiz.business.id);
      logSaas("rejected_attempt", {
        reason: "already_has_business",
        telegramUserId: telegramIdStr,
      });
      return true;
    }

    let hasPending: boolean;
    try {
      hasPending = await hasPendingRegistrationForTelegram(telegramIdStr);
    } catch (dbErr: unknown) {
      logStartHandlerError(dbErr, "/start DB: hasPendingRegistration failed");
      await ctx.reply(
        "Не удалось подключиться к базе данных. Проверьте DATABASE_URL и миграции Prisma на сервере."
      );
      return true;
    }

    if (hasPending) {
      await ctx.reply("Ваша заявка уже на рассмотрении");
      logSaas("rejected_attempt", {
        reason: "already_pending_request",
        telegramUserId: telegramIdStr,
      });
      return true;
    }

    sess.lastAttemptAt = now;
    sess.data = {};
    sess.step = "name";

    await ctx.reply(
      "Давайте создадим ваш магазин 🚀\nВведите название магазина."
    );

    logSaas("registration_started", { telegramUserId: telegramIdStr });
    return true;
  } catch (err: unknown) {
    logStartHandlerError(err, "START ERROR (unexpected)");
    try {
      await ctx.reply(
        "Ошибка сервера ❌ Попробуйте позже. Если повторится — см. лог Render (Prisma/DATABASE_URL)."
      );
    } catch (replyErr: unknown) {
      console.error("START ERROR (reply failed):", replyErr);
    }
    return true;
  }
}

export async function handleRegistrationCallbacks(
  ctx: Context
): Promise<boolean> {
  if (
    !("callbackQuery" in ctx) ||
    typeof ctx.callbackQuery !== "object" ||
    ctx.callbackQuery === null ||
    !("data" in ctx.callbackQuery)
  )
    return false;

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

    const applicantHasStore = await prisma.user.findFirst({
      where: { telegramId: row.telegramId },
      select: { id: true, businessId: true },
    });
    if (applicantHasStore) {
      console.warn(
        "[saasRegistration] approve blocked: applicant already linked to business",
        { requestId, businessId: applicantHasStore.businessId }
      );
      await ctx.editMessageText(
        "⚠️ Этот Telegram уже привязан к магазину — одобрение отменено."
      );
      await prisma.registrationRequest.update({
        where: { id: row.id },
        data: { status: RegistrationStatus.REJECTED },
      });
      return;
    }

    const slug = `shop-${requestId}-${Date.now().toString(36)}`;
    const trialEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

    const bizInUse = await prisma.business.findUnique({
      where: { botToken: row.botToken.trim() },
    });
    if (bizInUse) {
      console.warn(
        "[saasRegistration] approve blocked: bot token already in Business",
        { requestId, existingBusinessId: bizInUse.id }
      );
      await ctx.editMessageText(
        "⚠️ Этот токен уже привязан к активному Business."
      );
      await prisma.registrationRequest.update({
        where: { id: row.id },
        data: { status: "REJECTED" },
      });
      return;
    }

    let businessId!: number;

    await prisma.$transaction(async (tx) => {
      const tokenConflict = await tx.business.findUnique({
        where: { botToken: row.botToken.trim() },
        select: { id: true },
      });
      if (tokenConflict) {
        throw new Error("SAAS_APPROVE_TOKEN_CONFLICT");
      }
      const userConflict = await tx.user.findFirst({
        where: { telegramId: row.telegramId },
        select: { id: true },
      });
      if (userConflict) {
        throw new Error("SAAS_APPROVE_USER_CONFLICT");
      }
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

    const { registerDynamicUserBot } = await import("./dynamicBots.js");
    let botUsername = "";
    try {
      const r = await registerDynamicUserBot({
        businessId,
        botToken: row.botToken.trim(),
      });
      botUsername = r.username;
    } catch (e) {
      console.error("approve: registerDynamicUserBot failed:", e);
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
      await ctx.telegram
        .sendMessage(row.telegramId, "Ваш магазин активирован ✅", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Открыть магазин", web_app: { url: tgUrl } }],
            ],
          },
        })
        .catch((e: unknown) => console.error("approved user ping:", e));
    } else {
      await ctx.telegram
        .sendMessage(
          row.telegramId,
          `Ваш магазин активирован ✅\n` +
            `shop=${businessId} (задайте FRONT_URL для кнопки мини-приложения)`
        )
        .catch((e: unknown) => console.error("approved user ping:", e));
    }

    console.log("[saasRegistration] admin approve completed", {
      requestId,
      businessId,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (
      msg === "SAAS_APPROVE_TOKEN_CONFLICT" ||
      msg === "SAAS_APPROVE_USER_CONFLICT"
    ) {
      console.warn("[saasRegistration] approve transaction conflict:", msg, {
        requestId,
      });
      try {
        await prisma.registrationRequest.update({
          where: { id: requestId },
          data: { status: RegistrationStatus.REJECTED },
        });
      } catch {
        /* ignore */
      }
      try {
        await ctx.editMessageText(
          "⚠️ Токен или пользователь уже заняты (учтите при повторной заявке). Заявка отклонена."
        );
      } catch {
        /* ignore */
      }
      return;
    }
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
