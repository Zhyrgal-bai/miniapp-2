import type { Context } from "telegraf";
import { session } from "telegraf";
import type { Telegraf } from "telegraf";
import {
  BillingPlan,
  MembershipRole,
  Prisma,
  RegistrationStatus,
  SubscriptionStatus,
} from "@prisma/client";
import {
  encryptedBotTokenRow,
  hashBotTokenSha256Hex,
  plainBotTokenFromStored,
} from "../server/businessBotToken.js";
import { applyBusinessTemplate } from "../server/applyBusinessTemplate.js";
import { isEncryptedTokenFormat } from "../server/botTokenCrypto.js";
import { platformOperatorIdsFromEnv } from "../server/adminAuth.js";
import { logPrismaError, prisma } from "../server/db.js";
import {
  isValidFinikApiKey,
  isValidStoreName,
  validateKgPhone,
} from "./saasRegistrationValidation.js";
import {
  MSG_BOT_ALREADY_REGISTERED,
  precheckBotTokenBeforeRegistrationPersist,
} from "../server/registrationTokenGate.js";
import {
  consumeRegistrationSuperAdminPrivateMessage,
  REGISTRATION_ADMIN_REPLY_KEYBOARD_TEXT,
  registrationAdminReplyKeyboardMarkup,
  tryHandleRegistrationAdminReplyKeyboardButton,
} from "./registrationBotAdminPanel.js";

type BotRole =
  | { type: "env"; botIndex: number }
  | { type: "dynamic"; businessId: number };

type BusinessType = "clothing" | "coffee" | "fastfood" | "flowers";

const SUCCESS_REQUEST_SUBMITTED =
  "⏳ Заявка отправлена. Ожидайте подтверждения администратора";

/**
 * Состояние онбординга в `ctx.session` (ключ сессии = пользователь в private).
 * Telegraf 4: `import { session } from "telegraf"` (не `telegraf/session`).
 */
export type RegistrationSessionState = {
  step?: "businessType" | "name" | "token" | "phone" | "finik";
  /** ms epoch — только для потоков вроде «добавить магазин» из inline */
  lastAttemptAt?: number;
  data: {
    businessType?: BusinessType;
    name?: string;
    token?: string;
    phone?: string;
    finikApiKey?: string;
  };
  /** Скрытая панель /admin (только ADMIN_IDS + пароль), регистрационный бот */
  adminPanel?: {
    /** Успешный ввод ADMIN_PANEL_PASSWORD */
    isAdmin?: boolean;
    awaitingPassword?: boolean;
    inputMode?: "disable_id" | "extend_id" | "find_shop";
    /** После ввода ID — ожидается подтверждение отключения (inline) */
    pendingDisableBusinessId?: number;
    /** Одноразовый токен для callback продления подписки */
    extendConsumeToken?: string;
    extendPendingBusinessId?: number;
    /** Последняя активность авторизованного админа (ms epoch); TTL автовыхода */
    lastActivityAt?: number;
    passwordAttempts?: number;
    /** Блокировка ввода пароля до timestamp (ms epoch) */
    blockedUntil?: number;
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
  return platformOperatorIdsFromEnv();
}

/** Reply Keyboard «🛠 Админ панель» только для ADMIN_IDS (второй аргумент `ctx.reply`). */
function adminReplyKeyboardExtraIfAdmin(
  ctx: Context,
):
  | { reply_markup: ReturnType<typeof registrationAdminReplyKeyboardMarkup> }
  | undefined {
  const tidStr = telegramIdString(ctx);
  if (tidStr === "" || !adminTelegramNumericIds().includes(tidStr)) return undefined;
  return { reply_markup: registrationAdminReplyKeyboardMarkup() };
}

/** Reply Keyboard во время мастера регистрации: отмена + для ADMIN_IDS строка админ-панели. */
function registrationWizardReplyMarkup(ctx: Context): {
  keyboard: { text: string }[][];
  resize_keyboard: boolean;
  one_time_keyboard?: boolean;
} {
  const tidStr = telegramIdString(ctx);
  const isAdmin =
    tidStr !== "" && adminTelegramNumericIds().includes(tidStr);
  const cancelRow = [{ text: "❌ Отменить регистрацию" }];
  const rows = isAdmin
    ? [cancelRow, [{ text: REGISTRATION_ADMIN_REPLY_KEYBOARD_TEXT }]]
    : [cancelRow];
  return { keyboard: rows, resize_keyboard: true, one_time_keyboard: false };
}

function wizardExtra(ctx: Context): {
  reply_markup: ReturnType<typeof registrationWizardReplyMarkup>;
} {
  return { reply_markup: registrationWizardReplyMarkup(ctx) };
}

async function removeReplyKeyboardStub(ctx: Context): Promise<void> {
  try {
    await ctx.reply("\u2060", { reply_markup: { remove_keyboard: true } });
  } catch {
    /* ignore */
  }
}

/** После /cancel или сброса мастера: меню как после /start (без входа в анкету). */
async function replyAfterRegistrationExit(ctx: Context): Promise<void> {
  const telegramIdStr = telegramIdString(ctx);
  if (telegramIdStr === "") return;

  let memberships: MerchantMembershipRow[];
  try {
    memberships = await findMerchantMembershipsForTelegram(telegramIdStr);
  } catch (dbErr: unknown) {
    logStartHandlerError(dbErr, "replyAfterRegistrationExit: memberships");
    await ctx.reply(
      "Не удалось загрузить данные. Попробуйте /start.",
      adminReplyKeyboardExtraIfAdmin(ctx),
    );
    return;
  }

  let hasPending: boolean;
  try {
    hasPending = await hasPendingRegistrationForTelegram(telegramIdStr);
  } catch (dbErr: unknown) {
    logStartHandlerError(dbErr, "replyAfterRegistrationExit: pending");
    await ctx.reply(
      "Не удалось загрузить данные. Попробуйте /start.",
      adminReplyKeyboardExtraIfAdmin(ctx),
    );
    return;
  }

  if (hasPending) {
    await removeReplyKeyboardStub(ctx);
    await ctx.reply(
      "Заявка на рассмотрении — ответ будет в этом чате.",
      adminReplyKeyboardExtraIfAdmin(ctx),
    );
    return;
  }

  if (memberships.length > 0) {
    await removeReplyKeyboardStub(ctx);
    await replyMerchantStoreDashboard(ctx, memberships);
    return;
  }

  await removeReplyKeyboardStub(ctx);
  await ctx.reply(
    "Можно начать заново: отправьте /start — создадим магазин.\n\nКоманда /cancel в любой момент сбрасывает анкету.",
    adminReplyKeyboardExtraIfAdmin(ctx),
  );
}

/**
 * Отдельное сообщение с Reply Keyboard после inline-сообщения (нельзя совместить в одном sendMessage).
 */
async function sendGlobalAdminReplyKeyboardIfAdmin(ctx: Context): Promise<void> {
  const extra = adminReplyKeyboardExtraIfAdmin(ctx);
  if (!extra) return;
  await ctx.reply("\u2060", extra);
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

/** Сообщение вида /start или /start@BotName (и с параметром). */
export function isTelegramStartCommandText(text: string): boolean {
  return /^\/start(?:@[^\s]*)?(?:\s|$)/i.test(text.trim());
}

export function isTelegramCancelCommandText(text: string): boolean {
  return /^\/cancel(?:@[^\s]*)?(?:\s|$)/i.test(text.trim());
}

function resetRegistrationSessionCompletely(ctx: Context): void {
  (ctx as { session?: RegistrationSessionState }).session = { data: {} };
}

/** После успешной отправки заявки: только шаг и данные (cooldown сохраняется). */
function resetRegistrationWizardFields(ctx: Context): void {
  const sess = getRegistrationSession(ctx);
  if (!sess) return;
  delete sess.step;
  sess.data = {};
}

function logSaas(
  event:
    | "registration_started"
    | "registration_completed"
    | "rejected_attempt"
    | "merchant_dashboard_opened",
  meta: Record<string, unknown>
): void {
  console.log(`[saasRegistration] ${event}`, meta);
}

function logStartHandlerError(err: unknown, label: string): void {
  logPrismaError(`saasRegistration:${label}`, err);
}

/** Публичный HTTPS-корень Mini App (без финального `/`). */
function merchantMiniAppBaseUrl(): string {
  return (
    process.env.MINI_APP_URL ||
    process.env.FRONTEND_URL ||
    process.env.FRONT_URL ||
    process.env.PUBLIC_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
}

function storefrontMiniAppRelativePath(b: {
  id: number;
  slug: string | null;
}): string {
  const s = typeof b.slug === "string" ? b.slug.trim() : "";
  if (s !== "") return `/s/${encodeURIComponent(s)}`;
  return `/?shop=${encodeURIComponent(String(b.id))}`;
}

function miniAppMerchantCabinetUrl(): string | null {
  const base = merchantMiniAppBaseUrl();
  if (base === "") return null;
  return `${base}/merchant`;
}

/** Магазины, где пользователь — OWNER или ADMIN. */
async function findMerchantMembershipsForTelegram(telegramId: string) {
  const identity = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true },
  });
  if (!identity) {
    return [];
  }
  return prisma.membership.findMany({
    where: {
      userId: identity.id,
      role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN] },
    },
    include: { business: true },
    orderBy: [{ businessId: "asc" }, { id: "asc" }],
  });
}

type MerchantMembershipRow = Awaited<
  ReturnType<typeof findMerchantMembershipsForTelegram>
>[number];

/** Список витрин + Mini App-кнопки + заявка на ещё один магазин. */
async function replyMerchantStoreDashboard(
  ctx: Context,
  rows: MerchantMembershipRow[],
): Promise<void> {
  if (rows.length === 0) return;

  const base = merchantMiniAppBaseUrl();

  const title =
    rows.length === 1
      ? `Ваш магазин: «${rows[0]!.business.name}»`
      : `У вас ${rows.length} магазинов. Выберите витрину или добавьте ещё:`;

  const lines: string[] = [title];
  if (!base) {
    lines.push(
      "",
      "Ссылки на ваши магазины в Mini App включатся после настройки адресов витрины на сервере.",
    );
    rows.forEach((r, i) => {
      const slug =
        typeof r.business.slug === "string" ? r.business.slug.trim() : "";
      const ref =
        slug !== ""
          ? `s/${slug}`
          : `shop=${r.business.id}`;
      lines.push(`${i + 1}. «${r.business.name}» — ${ref}`);
    });
  }

  type Kb =
    | { text: string; web_app: { url: string } }
    | { text: string; callback_data: string };
  const keyboard: Kb[][] = [];

  if (base) {
    for (const row of rows) {
      const b = row.business;
      const path = storefrontMiniAppRelativePath(b);
      const q = path.includes("?") ? "&" : "?";
      const storeUrl = `${base}${path}`;
      const ordersUrl = `${base}${path}${q}view=my-orders`;
      const short =
        b.name.length > 18 ? `${b.name.slice(0, 17)}…` : b.name;
      keyboard.push([
        { text: `🛍 ${short}`, web_app: { url: storeUrl } },
        { text: "📦 Заказы", web_app: { url: ordersUrl } },
      ]);
    }
    const cabinetUrl = miniAppMerchantCabinetUrl();
    if (cabinetUrl != null) {
      keyboard.push([
        {
          text: "📊 Кабинет (подписки)",
          web_app: { url: cabinetUrl },
        },
      ]);
    }
  }

  keyboard.push([
    { text: "➕ Добавить магазин", callback_data: "saas_new_store" },
  ]);

  await ctx.reply(lines.join("\n"), {
    reply_markup: { inline_keyboard: keyboard },
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

function businessTypePickerMarkup() {
  return {
    inline_keyboard: [
      [
        { text: "👕 Одежда", callback_data: "bt_clothing" },
        { text: "☕ Кофейня", callback_data: "bt_coffee" },
      ],
      [
        { text: "🍔 Фастфуд", callback_data: "bt_fastfood" },
        { text: "🌸 Цветочный", callback_data: "bt_flowers" },
      ],
    ],
  };
}

function isBusinessType(v: unknown): v is BusinessType {
  return v === "clothing" || v === "coffee" || v === "fastfood" || v === "flowers";
}

function isFinikSkipInput(raw: string): boolean {
  const t = raw.trim();
  if (t === "-") return true;
  const low = t.toLowerCase();
  return low === "skip" || low === "нет";
}

/** Business + Settings + OWNER membership (после approve админом). */
async function provisionMerchantStoreInTx(
  tx: Prisma.TransactionClient,
  params: {
    name: string;
    botToken: string;
    telegramId: string;
    slugSuffix: string;
    finikApiKey?: string | null;
    businessType: BusinessType;
  },
): Promise<number> {
  const slug = `shop-${params.slugSuffix}`;
  const botTok = params.botToken.trim();
  const tokRow = encryptedBotTokenRow(botTok);
  const finikTrimmed = params.finikApiKey?.trim();
  const useFinik = finikTrimmed != null && finikTrimmed.length > 0;

  const ownerUser = await tx.user.upsert({
    where: { telegramId: params.telegramId },
    update: { name: normalizeStoreName(params.name) },
    create: {
      telegramId: params.telegramId,
      name: normalizeStoreName(params.name),
    },
    select: { id: true, hasUsedTrial: true },
  });

  const giveTrial = !ownerUser.hasUsedTrial;
  const trialEnd = giveTrial
    ? new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
    : null;

  const business = await tx.business.create({
    data: {
      name: params.name.trim(),
      slug,
      botToken: tokRow.botToken,
      botTokenHash: tokRow.botTokenHash,
      finikApiKey: useFinik ? finikTrimmed! : null,
      businessType: params.businessType,
      // Витрина должна быть включена сразу после approve; доступ может ограничиваться подпиской.
      isActive: true,
      isBlocked: false,
      subscriptionStatus: giveTrial
        ? SubscriptionStatus.TRIALING
        : SubscriptionStatus.EXPIRED,
      billingPlan: BillingPlan.FREE,
      trialEndsAt: trialEnd,
      subscriptionEndsAt: null,
    } as any,
  });

  if (giveTrial) {
    await tx.user.update({
      where: { id: ownerUser.id },
      data: { hasUsedTrial: true },
    });
  }

  await tx.settings.create({
    data: {
      businessId: business.id,
      paymentProvider: useFinik ? "finik" : null,
    },
  });

  await tx.membership.create({
    data: {
      userId: ownerUser.id,
      businessId: business.id,
      role: MembershipRole.OWNER,
    },
  });

  return business.id;
}

/** Память сессии + сброс перед /start. Должно идти до `tgBot.start` и до SaaS-хвоста. */
export function attachSaasRegistrationSessionBootstrap(
  bot: Telegraf,
  role: BotRole
): void {
  if (role.type !== "env" || role.botIndex !== 0) {
    return;
  }

  bot.use(
    session({
      defaultSession: (): RegistrationSessionState => ({
        data: {},
      }),
      getSessionKey: (ctx) => {
        const fromId = ctx.from?.id;
        if (fromId == null) return undefined;
        /** У callback-кнопок иногда нет ctx.chat без message — иначе сессия теряется. */
        const chat =
          ctx.chat ??
          (ctx.callbackQuery != null &&
          typeof ctx.callbackQuery === "object" &&
          "message" in ctx.callbackQuery &&
          ctx.callbackQuery.message != null &&
          typeof ctx.callbackQuery.message === "object" &&
          "chat" in ctx.callbackQuery.message
            ? (
                ctx.callbackQuery.message as {
                  chat?: { type?: string };
                }
              ).chat
            : undefined);
        return chat?.type === "private" ? `saas_reg:${fromId}` : undefined;
      },
    })
  );

  bot.use(async (ctx, next) => {
    if (ctx.chat?.type === "private" && ctx.from != null) {
      const c = ctx as { session?: RegistrationSessionState };
      if (c.session == null || typeof c.session !== "object") {
        c.session = { data: {} };
      } else if (!c.session.data || typeof c.session.data !== "object") {
        c.session.data = {};
      }
    }
    await next();
  });

  /**
   * Сброс стейта до registrationFlow/admin reply — параметр /start обрабатывает `tgBot.start`.
   */
  bot.use(async (ctx, next) => {
    if (ctx.chat?.type !== "private") {
      await next();
      return;
    }
    const msg = ctx.message;
    const text =
      msg != null && "text" in msg && typeof msg.text === "string"
        ? msg.text
        : "";
    if (text !== "" && isTelegramStartCommandText(text)) {
      resetRegistrationSessionCompletely(ctx);
    }
    await next();
  });
}

/** cancel, админ-сообщения, мастер регистрации — после `tgBot.start`, чтобы /start всегда обрабатывался первым. */
export function attachSaasRegistrationFlows(bot: Telegraf, role: BotRole): void {
  if (role.type !== "env" || role.botIndex !== 0) {
    return;
  }

  bot.command("cancel", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    resetRegistrationSessionCompletely(ctx);
    try {
      await ctx.reply("❌ Регистрация отменена", {
        reply_markup: { remove_keyboard: true },
      });
    } catch {
      /* ignore */
    }
    await replyAfterRegistrationExit(ctx);
  });

  bot.use(async (ctx, next) => {
    try {
      if (ctx.chat?.type === "private") {
        if (await tryHandleRegistrationAdminReplyKeyboardButton(ctx)) {
          return;
        }
        if (await consumeRegistrationSuperAdminPrivateMessage(ctx)) {
          return;
        }
      }
      await next();
    } catch (e) {
      console.error("registrationSuperAdmin middleware:", e);
      await next();
    }
  });

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
 * Пошаговая регистрация SaaS (имя → токен → телефон → Finik).
 * Всегда только заявка PENDING до ручного approve. Возвращает `true`, если сообщение обработано.
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

  if (
    trimmedInput === "/cancel" ||
    isTelegramCancelCommandText(trimmedInput) ||
    trimmedInput === "❌ Отменить регистрацию"
  ) {
    resetRegistrationSessionCompletely(ctx);
    try {
      await ctx.reply("❌ Регистрация отменена", {
        reply_markup: { remove_keyboard: true },
      });
    } catch {
      /* ignore */
    }
    await replyAfterRegistrationExit(ctx);
    return true;
  }

  /** Повторный /start в мастере — не перехватываем: `handleRegistrationStartCommand` сбросит сессию и покажет меню. */
  if (sess.step !== undefined && isTelegramStartCommandText(trimmedInput)) {
    return false;
  }

  if (trimmedInput === "") {
    await ctx.reply("Пожалуйста, введите непустой текст.", wizardExtra(ctx));
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
        "Введите название магазина (от 2 до 160 символов, не только пробелы).",
        wizardExtra(ctx),
      );
      return true;
    }
    sess.data.name = clean.slice(0, 160);
    sess.step = "token";
    await ctx.reply(
      "Введите токен бота от @BotFather (выглядит как `123456:ABC...`):",
      wizardExtra(ctx),
    );
    return true;
  }

  if (sess.step === "businessType") {
    await ctx.reply(
      "Выберите тип бизнеса кнопкой ниже:",
      {
        reply_markup: businessTypePickerMarkup(),
      },
    );
    return true;
  }

  if (sess.step === "token") {
    const tokenTrimmed = clean.replace(/\s/g, "");
    const gate = await precheckBotTokenBeforeRegistrationPersist(tokenTrimmed);
    if (!gate.ok) {
      await ctx.reply(gate.error, wizardExtra(ctx));
      logSaas("rejected_attempt", {
        reason:
          gate.error === MSG_BOT_ALREADY_REGISTERED
            ? "token_already_registered"
            : "invalid_bot_token",
        telegramUserId: telegramIdString(ctx),
      });
      return true;
    }
    sess.data.token = tokenTrimmed;
    sess.step = "phone";
    await ctx.reply(
      "Введите номер телефона (формат KG: +996XXXXXXXXX или 0XXXXXXXXX).",
      wizardExtra(ctx),
    );
    return true;
  }

  if (sess.step === "phone") {
    const phone = clean.trim();
    if (!validateKgPhone(phone)) {
      await ctx.reply(
        "Неверный формат номера. Пример: +996501234567 или 0700123456",
        wizardExtra(ctx),
      );
      return true;
    }
    sess.data.phone = phone;
    sess.step = "finik";
    await ctx.reply(
      "Введите API ключ Finik (онлайн ККМ).\n\nЧтобы пропустить, отправьте: `-` или `skip` или `нет`.",
      wizardExtra(ctx),
    );
    return true;
  }

  if (sess.step === "finik") {
    const finikInput = trimmedInput.trim();
    const useFinik = !isFinikSkipInput(finikInput);
    if (useFinik && !isValidFinikApiKey(finikInput)) {
      await ctx.reply(
        "Введите корректный API-ключ Finik (от 4 до 2048 символов, без переносов строк).",
        wizardExtra(ctx),
      );
      return true;
    }

    const name = sess.data.name ?? "";
    const token = sess.data.token ?? "";
    const phone = sess.data.phone ?? "";
    const businessType = sess.data.businessType;

    try {
      const tid = telegramIdString(ctx);

      const duplicatePending = await prisma.registrationRequest.findFirst({
        where: {
          telegramId: tid,
          status: RegistrationStatus.PENDING,
        },
        select: { id: true },
      });
      if (duplicatePending) {
        await ctx.reply(
          "У вас уже есть заявка на рассмотрении — ответ придёт здесь после проверки.",
          { reply_markup: { remove_keyboard: true } },
        );
        resetRegistrationWizardFields(ctx);
        logSaas("rejected_attempt", {
          reason: "duplicate_pending_at_submit",
          telegramUserId: telegramIdString(ctx),
        });
        return true;
      }

      if (businessType == null || !isBusinessType(businessType) || name === "" || token === "") {
        resetRegistrationWizardFields(ctx);
        await ctx.reply(
          "Шаги сбросились. Нажмите /start и заново укажите данные магазина.",
          { reply_markup: { remove_keyboard: true } },
        );
        logSaas("rejected_attempt", {
          reason: "stale_session_submit",
          telegramUserId: telegramIdString(ctx),
        });
        return true;
      }

      const finalGate = await precheckBotTokenBeforeRegistrationPersist(token);
      if (!finalGate.ok) {
        await ctx.reply(finalGate.error, wizardExtra(ctx));
        logSaas("rejected_attempt", {
          reason: "token_conflict_before_insert",
          telegramUserId: tid,
        });
        return true;
      }

      const row = await prisma.registrationRequest.create({
        data: {
          name,
          botToken: token,
          phone,
          finikApiKey: useFinik ? finikInput.trim() : null,
          businessType,
          telegramId: tid,
          status: RegistrationStatus.PENDING,
        } as any,
      });

      resetRegistrationWizardFields(ctx);
      logSaas("registration_completed", {
        telegramUserId: tid,
        requestId: row.id,
      });

      await ctx.reply(SUCCESS_REQUEST_SUBMITTED, {
        reply_markup: { remove_keyboard: true },
      });

      const admins = adminTelegramNumericIds();
      if (admins.length === 0) {
        console.warn(
          "[saasRegistration] ADMIN_IDS пуст — заявке в Telegram некому нажать «Одобрить».",
        );
        return true;
      }

      const lines = [
        "📩 Новая заявка на магазин",
        `ID заявки: #${row.id}`,
        `Название: ${row.name}`,
        `Телефон: ${row.phone}`,
        `Telegram пользователя (id): ${row.telegramId}`,
        `Finik ККМ: ${useFinik ? "да" : "нет"}`,
      ];

      for (const aid of admins) {
        await _bot.telegram
          .sendMessage(aid, lines.join("\n"), {
            reply_markup: registrationMarkup(row.id),
          })
          .catch((e: unknown) => {
            console.error("[saasRegistration] notify admin:", aid, e);
          });
      }
      return true;
    } catch (e: unknown) {
      console.error("registration save:", e);
      logSaas("rejected_attempt", {
        reason: "save_error",
        telegramUserId: telegramIdString(ctx),
      });
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        await ctx.reply(MSG_BOT_ALREADY_REGISTERED, wizardExtra(ctx));
        return true;
      }
      await ctx.reply(
        "Сейчас не получилось завершить регистрацию. Попробуйте через минуту или нажмите /start снова.",
        wizardExtra(ctx),
      );
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
      await ctx.reply("Не вижу ваш Telegram-профиль. Откройте бота из аккаунта и нажмите /start снова.");
      return true;
    }

    const telegramIdStr = telegramIdString(ctx);

    /** Повторный сброс в обработчике (после session-middleware): гарантия «чистого» ctx. */
    resetRegistrationSessionCompletely(ctx);

    const sess = getRegistrationSession(ctx);
    if (!sess) {
      console.error("[saasRegistration] /start: session missing for private DM", {
        telegramUserId: telegramIdStr,
      });
      await ctx.reply("Откройте чат заново или нажмите /start ещё раз.");
      return true;
    }

    let memberships: MerchantMembershipRow[];
    try {
      memberships = await findMerchantMembershipsForTelegram(telegramIdStr);
    } catch (dbErr: unknown) {
      logStartHandlerError(dbErr, "/start DB: findMerchantMemberships failed");
      await ctx.reply(
        "Сервис сейчас перегружен. Попробуйте через минуту."
      );
      return true;
    }

    let hasPending: boolean;
    try {
      hasPending = await hasPendingRegistrationForTelegram(telegramIdStr);
    } catch (dbErr: unknown) {
      logStartHandlerError(dbErr, "/start DB: hasPendingRegistration failed");
      await ctx.reply(
        "Сервис сейчас перегружен. Попробуйте через минуту."
      );
      return true;
    }

    if (hasPending) {
      await removeReplyKeyboardStub(ctx);
      await ctx.reply(
        "Заявка на рассмотрении — ответ будет в этом чате.",
        adminReplyKeyboardExtraIfAdmin(ctx),
      );
      logSaas("rejected_attempt", {
        reason: "already_pending_request",
        telegramUserId: telegramIdStr,
      });
      return true;
    }

    if (memberships.length > 0) {
      await removeReplyKeyboardStub(ctx);
      await replyMerchantStoreDashboard(ctx, memberships);
      logSaas("merchant_dashboard_opened", {
        telegramUserId: telegramIdStr,
        storeCount: memberships.length,
      });
      return true;
    }

    sess.data = {};
    sess.step = "businessType";

    await ctx.reply("Выберите тип бизнеса:", {
      reply_markup: businessTypePickerMarkup(),
    });

    logSaas("registration_started", { telegramUserId: telegramIdStr });
    return true;
  } catch (err: unknown) {
    logStartHandlerError(err, "START ERROR (unexpected)");
    try {
      await ctx.reply(
        "Что-то пошло не так. Нажмите /start через минуту."
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

  if (data.startsWith("bt_")) {
    const sess = getRegistrationSession(ctx);
    if (ctx.chat?.type !== "private" || !sess) {
      await ctx.answerCbQuery("Только в личном чате").catch(() => undefined);
      return true;
    }
    if (sess.step !== "businessType") {
      await ctx.answerCbQuery().catch(() => undefined);
      return true;
    }
    const map: Record<string, BusinessType> = {
      bt_clothing: "clothing",
      bt_coffee: "coffee",
      bt_fastfood: "fastfood",
      bt_flowers: "flowers",
    };
    const picked = map[data];
    if (!isBusinessType(picked)) {
      await ctx.answerCbQuery("Неизвестный тип").catch(() => undefined);
      return true;
    }
    sess.data.businessType = picked;
    sess.step = "name";
    await ctx.answerCbQuery("Выбрано").catch(() => undefined);
    await ctx.reply(
      "Давайте создадим ваш магазин 🚀\nВведите название магазина.",
      wizardExtra(ctx),
    );
    return true;
  }

  if (data === "saas_new_store") {
    if (ctx.chat?.type !== "private") {
      try {
        await ctx.answerCbQuery("Только в личном чате");
      } catch {
        /* ignore */
      }
      return true;
    }
    const tid = telegramIdString(ctx);
    if (tid === "") {
      try {
        await ctx.answerCbQuery();
      } catch {
        /* ignore */
      }
      return true;
    }
    try {
      if (await hasPendingRegistrationForTelegram(tid)) {
        await ctx.answerCbQuery("Сначала дождитесь решения по заявке");
        return true;
      }
      const sess = getRegistrationSession(ctx);
      if (!sess) {
        await ctx.answerCbQuery("Нажмите /start");
        return true;
      }
      if (sess.step) {
        await ctx.answerCbQuery("Завершите текущую регистрацию");
        return true;
      }
      sess.step = "businessType";
      sess.data = {};
      sess.lastAttemptAt = Date.now();
      await ctx
        .answerCbQuery("Выберите тип бизнеса")
        .catch(() => undefined);
      await ctx.reply(
        "Новый магазин 🚀\nВыберите тип бизнеса:",
        { reply_markup: businessTypePickerMarkup() },
      );
      logSaas("registration_started", {
        telegramUserId: tid,
        reason: "add_store_from_dashboard",
      });
    } catch (e) {
      console.error("saas_new_store callback:", e);
      await ctx.answerCbQuery("Позже попробуйте").catch(() => undefined);
    }
    return true;
  }

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
    console.log("=== APPROVE START ===");
    const row = await prisma.registrationRequest.findUnique({
      where: { id: requestId },
    });
    if (!row || row.status !== RegistrationStatus.PENDING) {
      await ctx.editMessageText("❌ Заявка уже обработана или не найдена.");
      return;
    }

    const rh = hashBotTokenSha256Hex(row.botToken.trim());
    const bizInUse = await prisma.business.findUnique({
      where: { botTokenHash: rh },
    });
    if (bizInUse) {
      console.warn("[saasRegistration] approve blocked: token already in Business", {
        requestId,
        existingBusinessId: bizInUse.id,
      });
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
        where: { botTokenHash: rh },
        select: { id: true },
      });
      if (tokenConflict) {
        throw new Error("SAAS_APPROVE_TOKEN_CONFLICT");
      }
      businessId = await provisionMerchantStoreInTx(tx, {
        name: row.name,
        botToken: row.botToken.trim(),
        telegramId: row.telegramId,
        slugSuffix: `${requestId}-${Date.now().toString(36)}`,
        finikApiKey: row.finikApiKey,
        businessType: (row as any).businessType,
      });

      await tx.registrationRequest.update({
        where: { id: row.id },
        data: { status: "APPROVED" },
      });
    });

    console.log("BUSINESS CREATED:", businessId);

    try {
      await applyBusinessTemplate({
        prisma,
        businessId,
        businessType: (row as any).businessType,
      });
    } catch (e) {
      console.error("[saasRegistration] applyBusinessTemplate failed:", {
        requestId,
        businessId,
        err: e,
      });
    }

    const bizFromDb = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, botToken: true, slug: true },
    });
    const storedToken = bizFromDb?.botToken ?? "";
    console.log("TOKEN BEFORE DECRYPT:", `${String(storedToken).slice(0, 24)}…(len=${String(storedToken).length})`);

    let tokenPlain: string;
    try {
      tokenPlain = plainBotTokenFromStored(storedToken);
    } catch (de: unknown) {
      console.error("APPROVE: decrypt exception:", businessId, de);
      tokenPlain = "";
    }
    console.log(
      "TOKEN AFTER DECRYPT:",
      tokenPlain === ""
        ? "(empty)"
        : `${tokenPlain.slice(0, 10)}…(len=${tokenPlain.length})`,
    );
    if (!tokenPlain || isEncryptedTokenFormat(tokenPlain.trim())) {
      console.error(
        "APPROVE: token empty or still enc-shaped after decrypt; businessId=",
        businessId,
      );
    }

    console.log("LAUNCH BOT...");
    const { launchClientBot } = await import("./launchClientBot.js");
    let botUsername = "";
    const launched =
      bizFromDb == null
        ? ({ ok: false, error: "Business row missing" } as const)
        : await launchClientBot(bizFromDb);
    if (launched.ok) {
      botUsername = launched.username;
    }

    await ctx.editMessageText(
      [
        `✅ Заявка #${requestId} одобрена.`,
        `Магазин id=${businessId}` +
          (botUsername !== "" ? ` · @${botUsername}` : ""),
        launched.ok
          ? ""
          : "Подскажите клиенту /start у его бота (из @BotFather), если меню не обновилось.",
      ]
        .filter((s) => s !== "")
        .join("\n"),
      { reply_markup: { inline_keyboard: [] } }
    );

    const front = merchantMiniAppBaseUrl();
    const rel =
      bizFromDb != null
        ? storefrontMiniAppRelativePath(bizFromDb)
        : `/?shop=${encodeURIComponent(String(businessId))}`;
    const tgUrl = front !== "" ? `${front}${rel}` : undefined;

    if (tgUrl) {
      await ctx.telegram
        .sendMessage(
          row.telegramId,
          [
            "Магазин подключён ✅",
            "",
            "Откройте своего бота из @BotFather, нажмите /start — там кнопка вашей витрины Mini App.",
          ].join("\n"),
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🛍 Открыть мой магазин", web_app: { url: tgUrl } }],
              ],
            },
          }
        )
        .catch((e: unknown) => console.error("approved user ping:", e));
    } else {
      await ctx.telegram
        .sendMessage(
          row.telegramId,
            [
            "Магазин подключён ✅",
            bizFromDb != null
              ? `Витрина: ${storefrontMiniAppRelativePath(bizFromDb)}`
              : `Витрина: shop=${businessId}`,
            "",
            "Откройте своего бота и отправьте /start.",
          ].join("\n")
        )
        .catch((e: unknown) => console.error("approved user ping:", e));
    }

    console.log("[saasRegistration] admin approve completed", {
      requestId,
      businessId,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "SAAS_APPROVE_TOKEN_CONFLICT") {
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
          "⚠️ Этот токен уже привязан к магазину. Заявка отклонена."
        );
      } catch {
        /* ignore */
      }
      return;
    }
    console.error("handleApproveFlow:", e);
    try {
      await ctx.editMessageText(
        "Не получилось создать магазин — попробуйте ещё раз или проверьте логи сервера."
      );
    } catch {
      /* ignore */
    }
  }
}
