import crypto from "node:crypto";
import type { Context } from "telegraf";
import {
  AdminActionType,
  MembershipRole,
  SubscriptionStatus,
} from "@prisma/client";
import { prisma } from "../server/db.js";
import { stopDynamicStoreBotInMemory } from "./dynamicBots.js";
import type { RegistrationSessionState } from "./saasRegistration.js";

function getPanelSession(ctx: Context): RegistrationSessionState | undefined {
  if (!("session" in ctx)) return undefined;
  const s = (ctx as { session?: RegistrationSessionState }).session;
  if (!s) return undefined;
  if (!s.data || typeof s.data !== "object") s.data = {};
  return s;
}

const CB_LIST = "rpadm_list";
const CB_DISABLE = "rpadm_disable";
const CB_EXTEND = "rpadm_extend";
const CB_MENU = "rpadm_menu";
/** Отмена подтверждения отключения магазина */
const CB_DISCONFIRM_NO = "rpadm_dcn";
const CB_LOGOUT = "rpadm_logout";
const CB_FIND = "rpadm_find";
const CB_STATS = "rpadm_stats";
const CB_EXPIRED = "rpadm_expired";
const CB_BACK = "rpadm_back";

/** Reply Keyboard: только для ADMIN_IDS, не путать с текстом от не-админов. */
export const REGISTRATION_ADMIN_REPLY_KEYBOARD_TEXT = "🛠 Админ панель";

export function registrationAdminReplyKeyboardMarkup(): {
  keyboard: { text: string }[][];
  resize_keyboard: boolean;
  one_time_keyboard: boolean;
} {
  return {
    keyboard: [[{ text: REGISTRATION_ADMIN_REPLY_KEYBOARD_TEXT }]],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

/**
 * Нажатие reply-кнопки «Админ панель»: та же логика, что /admin.
 * Не-админ с тем же текстом — глушим (true), чтобы не ушло в сценарии регистрации.
 */
export async function tryHandleRegistrationAdminReplyKeyboardButton(
  ctx: Context,
): Promise<boolean> {
  if (ctx.chat?.type !== "private") return false;
  const msg = ctx.message;
  if (!msg || !("text" in msg) || typeof msg.text !== "string") return false;
  const text = msg.text.trim();
  if (/^админ\s*панель$/iu.test(text) && text !== REGISTRATION_ADMIN_REPLY_KEYBOARD_TEXT) {
    return true;
  }
  if (text !== REGISTRATION_ADMIN_REPLY_KEYBOARD_TEXT) return false;

  const tid = ctx.from?.id;
  if (tid == null) return false;
  const tidStr = String(tid);
  if (!isPlatformAdminUser(tidStr)) {
    return true;
  }

  await ctx.reply(" ", {
    reply_markup: { remove_keyboard: true },
  });

  await tryHandleRegistrationSuperAdminCommand(ctx);
  return true;
}

/** Автовыход неактивной сессии (мс). */
const ADMIN_PANEL_TTL_MS = 10 * 60 * 1000;
/** Блокировка ввода пароля после серии ошибок (мс). */
const PASSWORD_LOCKOUT_MS = 5 * 60 * 1000;
const MAX_PASSWORD_ATTEMPTS = 3;

type AdminPanel = NonNullable<
  RegistrationSessionState["adminPanel"]
>;

function adminIdsFromEnv(): string[] {
  const raw = process.env.ADMIN_IDS;
  if (!raw) return [];
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

function adminPanelPasswordFromEnv(): string | null {
  const p = String(process.env.ADMIN_PANEL_PASSWORD ?? "").trim();
  return p === "" ? null : p;
}

function timingSafePasswordMatch(expected: string, received: string): boolean {
  const eh = crypto.createHash("sha256").update(expected, "utf8").digest();
  const rh = crypto.createHash("sha256").update(received, "utf8").digest();
  if (eh.length !== rh.length) return false;
  return crypto.timingSafeEqual(eh, rh);
}

function isPlatformAdminUser(tid: string): boolean {
  return adminIdsFromEnv().includes(tid);
}

function ensureAdminPanel(sess: RegistrationSessionState): NonNullable<
  RegistrationSessionState["adminPanel"]
> {
  if (!sess.adminPanel) sess.adminPanel = {};
  return sess.adminPanel;
}

/** Сброс шагов ввода и «висящих» подтверждений одноразовых операций. */
function clearAdminOpsState(ap: AdminPanel): void {
  delete ap.inputMode;
  delete ap.pendingDisableBusinessId;
  delete ap.extendConsumeToken;
  delete ap.extendPendingBusinessId;
}

function isPasswordCooldownActive(ap: AdminPanel): boolean {
  const u = ap.blockedUntil;
  return typeof u === "number" && Date.now() < u;
}

function touchAdminActivity(ap: AdminPanel): void {
  ap.lastActivityAt = Date.now();
}

/** Снимает авторизацию после TTL (счётчик попыток пароля не трогаем). */
function clearAdminAuthenticatedState(ap: AdminPanel): void {
  ap.isAdmin = false;
  ap.awaitingPassword = false;
  delete ap.lastActivityAt;
  clearAdminOpsState(ap);
}

/**
 * Живая авторизованная сессия: TTL + продление активности.
 * Сообщение при истечении — «Введите пароль заново».
 */
async function ensureAdminSessionValid(
  ctx: Context,
  ap: AdminPanel,
): Promise<boolean> {
  if (!ap.isAdmin) return false;
  const last = ap.lastActivityAt;
  const now = Date.now();
  if (
    last == null ||
    now - last > ADMIN_PANEL_TTL_MS ||
    !Number.isFinite(last)
  ) {
    clearAdminAuthenticatedState(ap);
    await ctx.reply("⏳ Сессия истекла. Введите пароль заново");
    return false;
  }
  touchAdminActivity(ap);
  return true;
}

function resetAdminPanelSession(sess: RegistrationSessionState): void {
  delete sess.adminPanel;
}

function navBackMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "⬅️ Назад", callback_data: CB_BACK },
        { text: "◀️ В меню", callback_data: CB_MENU },
      ],
    ],
  };
}

function adminMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "📋 Список магазинов", callback_data: CB_LIST }],
      [{ text: "❌ Удалить магазин", callback_data: CB_DISABLE }],
      [{ text: "🔄 Продлить подписку", callback_data: CB_EXTEND }],
      [{ text: "🔍 Найти магазин", callback_data: CB_FIND }],
      [{ text: "📊 Статистика", callback_data: CB_STATS }],
      [{ text: "⚠️ Просроченные", callback_data: CB_EXPIRED }],
      [{ text: "🚪 Выйти", callback_data: CB_LOGOUT }],
    ],
  };
}

async function sendExtendDaysChoice(
  ctx: Context,
  ap: AdminPanel,
  businessId: number,
): Promise<void> {
  const token = crypto.randomBytes(16).toString("hex");
  ap.extendConsumeToken = token;
  ap.extendPendingBusinessId = businessId;
  await ctx.reply("Выберите срок продления:", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "30 дней",
            callback_data: `rpadm_ext_30_${businessId}_${token}`,
          },
          {
            text: "90 дней",
            callback_data: `rpadm_ext_90_${businessId}_${token}`,
          },
        ],
        ...navBackMenuKeyboard().inline_keyboard,
      ],
    },
  });
}

async function sendAdminMenu(ctx: Context): Promise<void> {
  await ctx.reply("Панель администратора", {
    reply_markup: adminMainMenuKeyboard(),
  });
}

function formatBusinessStatus(b: {
  isActive: boolean;
  isBlocked: boolean;
  subscriptionStatus: SubscriptionStatus;
}): string {
  if (b.isBlocked) return "заблокирован";
  if (!b.isActive) return "неактивен";
  return String(b.subscriptionStatus);
}

type BusinessSafeSnapshot = {
  id: number;
  name: string;
  isActive: boolean;
  isBlocked: boolean;
  subscriptionStatus: SubscriptionStatus;
  subscriptionEndsAt: Date | null;
};

function previousStatusPayload(b: BusinessSafeSnapshot): Record<string, unknown> {
  return {
    shopName: b.name,
    previousStatusDisplay: formatBusinessStatus(b),
    isActive: b.isActive,
    isBlocked: b.isBlocked,
    subscriptionStatus: b.subscriptionStatus,
    subscriptionEndsAt:
      b.subscriptionEndsAt != null ? b.subscriptionEndsAt.toISOString() : null,
  };
}

async function persistAdminActionLog(input: {
  adminTelegramId: string;
  action: AdminActionType;
  targetBusinessId: number;
  details: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.adminActionLog.create({
      data: {
        adminTelegramId: input.adminTelegramId,
        action: input.action,
        targetBusinessId: input.targetBusinessId,
        details: input.details as object,
      },
    });
  } catch (e) {
    console.error("[registrationBotAdminPanel] AdminActionLog create failed:", e);
  }
}

async function notifyAdminActionDone(
  ctx: Context,
  input: { action: AdminActionType; businessId: number; atIso: string },
): Promise<void> {
  const recipient = ctx.from?.id ?? ctx.chat?.id;
  if (recipient === undefined || typeof recipient !== "number") return;
  await ctx.telegram
    .sendMessage(
      recipient,
      [
        "📌 Действие выполнено:",
        `Тип: ${input.action}`,
        `ID: ${input.businessId}`,
        `Время: ${input.atIso}`,
      ].join("\n"),
    )
    .catch(() => undefined);
}

/** Публичный API: команда /admin на рег-боте (первый env), только ADMIN_IDS. */
export async function tryHandleRegistrationSuperAdminCommand(
  ctx: Context,
): Promise<boolean> {
  if (ctx.chat?.type !== "private") return false;
  const tid = ctx.from?.id;
  if (tid == null) return false;
  const tidStr = String(tid);
  if (!isPlatformAdminUser(tidStr)) return false;

  const sess = getPanelSession(ctx);
  if (!sess) return false;
  const ap = ensureAdminPanel(sess);

  const pwConfig = adminPanelPasswordFromEnv();
  if (pwConfig == null) {
    await ctx.reply("⚠️ Панель не настроена (ADMIN_PANEL_PASSWORD).");
    return true;
  }

  if (!ap.isAdmin) {
    if (isPasswordCooldownActive(ap)) {
      await ctx.reply("⛔ Временно заблокировано");
      return true;
    }
    ap.awaitingPassword = true;
    clearAdminOpsState(ap);
    await ctx.reply("Введите пароль панели администратора.");
    return true;
  }

  if (!(await ensureAdminSessionValid(ctx, ap))) {
    return true;
  }

  ap.awaitingPassword = false;
  clearAdminOpsState(ap);
  await sendAdminMenu(ctx);
  return true;
}

/**
 * Сообщения (пароль, ввод ID) — после session middleware, только private + ADMIN_IDS.
 */
export async function consumeRegistrationSuperAdminPrivateMessage(
  ctx: Context,
): Promise<boolean> {
  if (ctx.chat?.type !== "private") return false;
  const tid = ctx.from?.id;
  if (tid == null) return false;
  const tidStr = String(tid);
  if (!isPlatformAdminUser(tidStr)) return false;

  const msg = ctx.message;
  if (!msg || !("text" in msg) || typeof msg.text !== "string") return false;
  const text = msg.text.trim();
  if (text === "" || text.startsWith("/")) return false;

  const sess = getPanelSession(ctx);
  if (!sess) return false;
  const ap = ensureAdminPanel(sess);
  const pwConfig = adminPanelPasswordFromEnv();

  if (
    pwConfig != null &&
    !ap.isAdmin &&
    ap.awaitingPassword &&
    isPasswordCooldownActive(ap)
  ) {
    await ctx.reply("⛔ Временно заблокировано");
    ap.awaitingPassword = false;
    return true;
  }

  if (!ap.isAdmin && !(ap.awaitingPassword && pwConfig != null)) {
    return false;
  }

  if (ap.awaitingPassword && pwConfig != null && !ap.isAdmin) {
    if (timingSafePasswordMatch(pwConfig, text)) {
      ap.isAdmin = true;
      ap.awaitingPassword = false;
      ap.passwordAttempts = 0;
      delete ap.blockedUntil;
      clearAdminOpsState(ap);
      touchAdminActivity(ap);
      await sendAdminMenu(ctx);
    } else {
      const nextAttempt = (ap.passwordAttempts ?? 0) + 1;
      if (nextAttempt >= MAX_PASSWORD_ATTEMPTS) {
        ap.blockedUntil = Date.now() + PASSWORD_LOCKOUT_MS;
        ap.passwordAttempts = 0;
        ap.awaitingPassword = false;
        await ctx.reply("⛔ Слишком много попыток. Попробуйте позже");
      } else {
        ap.passwordAttempts = nextAttempt;
        await ctx.reply("❌ Неверный пароль");
      }
    }
    return true;
  }

  if (!ap.isAdmin) return false;

  if (!(await ensureAdminSessionValid(ctx, ap))) {
    return true;
  }

  if (ap.inputMode === "disable_id") {
    const id = Number(text.replace(/\s/g, ""));
    if (!Number.isInteger(id) || id <= 0) {
      await ctx.reply("Введите положительное число — ID магазина.");
      return true;
    }
    const row = await prisma.business.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        isActive: true,
        isBlocked: true,
        subscriptionStatus: true,
      },
    });
    if (!row) {
      await ctx.reply("❌ Магазин не найден");
      delete ap.inputMode;
      return true;
    }
    if (row.isBlocked || !row.isActive) {
      await ctx.reply("⚠️ Уже отключён");
      delete ap.inputMode;
      return true;
    }

    delete ap.inputMode;
    ap.pendingDisableBusinessId = id;
    await ctx.reply("⚠️ Вы уверены?", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Да", callback_data: `rpadm_dok_${id}` },
            { text: "❌ Нет", callback_data: CB_DISCONFIRM_NO },
          ],
          ...navBackMenuKeyboard().inline_keyboard,
        ],
      },
    });
    return true;
  }

  if (ap.inputMode === "extend_id") {
    const id = Number(text.replace(/\s/g, ""));
    if (!Number.isInteger(id) || id <= 0) {
      await ctx.reply("Введите положительное число — ID магазина.");
      return true;
    }
    const row = await prisma.business.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        isActive: true,
        isBlocked: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
      },
    });
    if (!row) {
      await ctx.reply("❌ Магазин не найден");
      delete ap.inputMode;
      return true;
    }

    delete ap.inputMode;
    await sendExtendDaysChoice(ctx, ap, id);
    return true;
  }

  if (ap.inputMode === "find_shop") {
    const qRaw = text.trim().slice(0, 128);
    if (qRaw === "") {
      await ctx.reply("Укажите ID или часть названия магазина.", {
        reply_markup: navBackMenuKeyboard(),
      });
      return true;
    }

    delete ap.inputMode;

    type Hit = {
      id: number;
      name: string;
      isActive: boolean;
      isBlocked: boolean;
      subscriptionStatus: SubscriptionStatus;
    };

    let hits: Hit[] = [];
    if (/^\d+$/.test(qRaw)) {
      const numId = Number(qRaw);
      if (Number.isInteger(numId) && numId > 0) {
        const one = await prisma.business.findUnique({
          where: { id: numId },
          select: {
            id: true,
            name: true,
            isActive: true,
            isBlocked: true,
            subscriptionStatus: true,
          },
        });
        if (one) hits = [one];
      }
    } else {
      hits = await prisma.business.findMany({
        where: { name: { contains: qRaw, mode: "insensitive" } },
        take: 10,
        orderBy: { id: "asc" },
        select: {
          id: true,
          name: true,
          isActive: true,
          isBlocked: true,
          subscriptionStatus: true,
        },
      });
    }

    if (hits.length === 0) {
      await ctx.reply("Ничего не найдено.", {
        reply_markup: adminMainMenuKeyboard(),
      });
      return true;
    }

    const lines: string[] = ["🔎 Результат:"];
    for (const h of hits) {
      lines.push(`#${h.id} «${h.name}» — ${formatBusinessStatus(h)}`);
    }

    const inline_keyboard: Array<
      Array<{ text: string; callback_data: string }>
    > = [];
    for (const h of hits) {
      inline_keyboard.push([
        { text: `❌ ${h.id}`, callback_data: `rpadm_qdi_${h.id}` },
        { text: `🔄 ${h.id}`, callback_data: `rpadm_qpx_${h.id}` },
      ]);
    }
    inline_keyboard.push(...navBackMenuKeyboard().inline_keyboard);

    await ctx.reply(lines.join("\n"), {
      reply_markup: { inline_keyboard },
    });
    return true;
  }

  return false;
}

export async function handleRegistrationSuperAdminCallback(
  ctx: Context,
): Promise<boolean> {
  const cq = ctx.callbackQuery;
  if (!cq || !("data" in cq)) return false;
  const raw = cq.data;
  if (typeof raw !== "string" || !raw.startsWith("rpadm_")) return false;

  const tid = ctx.from?.id;
  if (tid == null || ctx.chat?.type !== "private") {
    await ctx.answerCbQuery("Недоступно").catch(() => undefined);
    return true;
  }
  const tidStr = String(tid);
  if (!isPlatformAdminUser(tidStr)) {
    await ctx.answerCbQuery("Нет доступа").catch(() => undefined);
    return true;
  }

  const sess = getPanelSession(ctx);
  if (!sess) {
    await ctx.answerCbQuery().catch(() => undefined);
    return true;
  }
  const ap = ensureAdminPanel(sess);
  const pwOk = adminPanelPasswordFromEnv() != null;

  if (!pwOk) {
    await ctx.answerCbQuery("Панель не настроена").catch(() => undefined);
    return true;
  }

  if (raw === CB_LOGOUT) {
    await ctx.answerCbQuery().catch(() => undefined);
    resetAdminPanelSession(sess);
    try {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch {
      /* ignore */
    }
    await ctx.reply("Вы вышли из админ-панели.", {
      reply_markup: { remove_keyboard: true },
    });
    return true;
  }

  if (!ap.isAdmin) {
    await ctx.answerCbQuery("Сначала /admin и пароль").catch(() => undefined);
    return true;
  }

  if (!(await ensureAdminSessionValid(ctx, ap))) {
    await ctx.answerCbQuery("Сессия истекла").catch(() => undefined);
    return true;
  }

  if (raw === CB_MENU || raw === CB_BACK) {
    await ctx.answerCbQuery().catch(() => undefined);
    clearAdminOpsState(ap);
    try {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch {
      /* ignore */
    }
    await ctx.reply("Панель администратора", {
      reply_markup: adminMainMenuKeyboard(),
    });
    return true;
  }

  if (raw === CB_FIND) {
    await ctx.answerCbQuery().catch(() => undefined);
    clearAdminOpsState(ap);
    ap.inputMode = "find_shop";
    try {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch {
      /* ignore */
    }
    await ctx.reply("Введите ID магазина или часть названия:", {
      reply_markup: navBackMenuKeyboard(),
    });
    return true;
  }

  if (raw === CB_STATS) {
    await ctx.answerCbQuery().catch(() => undefined);
    const now = new Date();
    const [total, blocked, activeListed, overdueSub] = await Promise.all([
      prisma.business.count(),
      prisma.business.count({ where: { isBlocked: true } }),
      prisma.business.count({
        where: { isActive: true, isBlocked: false },
      }),
      prisma.business.count({
        where: {
          subscriptionEndsAt: { lt: now },
          isBlocked: false,
        },
      }),
    ]);
    try {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch {
      /* ignore */
    }
    await ctx.reply(
      [
        "📊 Статистика",
        `Всего магазинов: ${total}`,
        `Активных: ${activeListed}`,
        `Заблокированных: ${blocked}`,
        `С истёкшей подпиской: ${overdueSub}`,
      ].join("\n"),
      { reply_markup: adminMainMenuKeyboard() },
    );
    return true;
  }

  if (raw === CB_EXPIRED) {
    await ctx.answerCbQuery().catch(() => undefined);
    try {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch {
      /* ignore */
    }
    const now = new Date();
    const overdue = await prisma.business.findMany({
      where: {
        subscriptionEndsAt: { lt: now },
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        isBlocked: true,
        subscriptionStatus: true,
      },
      orderBy: { subscriptionEndsAt: "asc" },
      take: 24,
    });
    if (overdue.length === 0) {
      await ctx.reply("Нет просроченных подписок (по полю подписки).", {
        reply_markup: adminMainMenuKeyboard(),
      });
      return true;
    }
    const lines: string[] = ["⚠️ Просроченные подписки:"];
    for (const r of overdue) {
      lines.push(`#${r.id} «${r.name}» — ${formatBusinessStatus(r)}`);
    }
    const inline_keyboard: Array<
      Array<{ text: string; callback_data: string }>
    > = [];
    for (const r of overdue.slice(0, 12)) {
      inline_keyboard.push([
        { text: `❌ ${r.id}`, callback_data: `rpadm_qdi_${r.id}` },
        { text: `🔄 ${r.id}`, callback_data: `rpadm_qpx_${r.id}` },
      ]);
    }
    inline_keyboard.push(...navBackMenuKeyboard().inline_keyboard);
    await ctx.reply(lines.join("\n"), {
      reply_markup: { inline_keyboard },
    });
    return true;
  }

  if (raw === CB_DISCONFIRM_NO) {
    await ctx.answerCbQuery().catch(() => undefined);
    delete ap.pendingDisableBusinessId;
    try {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch {
      /* ignore */
    }
    await ctx.reply("Отменено.", {
      reply_markup: adminMainMenuKeyboard(),
    });
    return true;
  }

  const qdiQuick = /^rpadm_qdi_(\d+)$/.exec(raw);
  if (qdiQuick) {
    const businessId = Number(qdiQuick[1]);
    if (!Number.isInteger(businessId) || businessId <= 0) {
      await ctx.answerCbQuery("Неверный id").catch(() => undefined);
      return true;
    }
    await ctx.answerCbQuery().catch(() => undefined);
    try {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch {
      /* ignore */
    }
    const b = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, isBlocked: true, isActive: true },
    });
    if (!b) {
      await ctx.reply("❌ Магазин не найден", {
        reply_markup: adminMainMenuKeyboard(),
      });
      return true;
    }
    if (b.isBlocked || !b.isActive) {
      await ctx.reply("⚠️ Уже отключён", {
        reply_markup: adminMainMenuKeyboard(),
      });
      return true;
    }
    ap.pendingDisableBusinessId = businessId;
    await ctx.reply("⚠️ Вы уверены?", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Да", callback_data: `rpadm_dok_${businessId}` },
            { text: "❌ Нет", callback_data: CB_DISCONFIRM_NO },
          ],
          ...navBackMenuKeyboard().inline_keyboard,
        ],
      },
    });
    return true;
  }

  const qpxQuick = /^rpadm_qpx_(\d+)$/.exec(raw);
  if (qpxQuick) {
    const businessId = Number(qpxQuick[1]);
    if (!Number.isInteger(businessId) || businessId <= 0) {
      await ctx.answerCbQuery("Неверный id").catch(() => undefined);
      return true;
    }
    await ctx.answerCbQuery().catch(() => undefined);
    try {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch {
      /* ignore */
    }
    const exists = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    if (!exists) {
      await ctx.reply("❌ Магазин не найден", {
        reply_markup: adminMainMenuKeyboard(),
      });
      return true;
    }
    await sendExtendDaysChoice(ctx, ap, businessId);
    return true;
  }

  const dokMatch = /^rpadm_dok_(\d+)$/.exec(raw);
  if (dokMatch) {
    const businessId = Number(dokMatch[1]);
    if (
      !Number.isInteger(businessId) ||
      businessId <= 0 ||
      ap.pendingDisableBusinessId !== businessId
    ) {
      await ctx
        .answerCbQuery("Подтверждение устарело — введите ID снова")
        .catch(() => undefined);
      delete ap.pendingDisableBusinessId;
      return true;
    }

    await ctx.answerCbQuery().catch(() => undefined);

    const before = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        isActive: true,
        isBlocked: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
      },
    });

    if (!before) {
      delete ap.pendingDisableBusinessId;
      await ctx.reply("❌ Магазин не найден", {
        reply_markup: adminMainMenuKeyboard(),
      });
      return true;
    }
    if (before.isBlocked || !before.isActive) {
      delete ap.pendingDisableBusinessId;
      await ctx.reply("⚠️ Уже отключён", {
        reply_markup: adminMainMenuKeyboard(),
      });
      return true;
    }

    delete ap.pendingDisableBusinessId;

    await prisma.business.update({
      where: { id: businessId },
      data: { isActive: false, isBlocked: true },
    });
    await stopDynamicStoreBotInMemory(businessId);

    const details = previousStatusPayload(before);
    const at = new Date();
    await persistAdminActionLog({
      adminTelegramId: tidStr,
      action: AdminActionType.DELETE_SHOP,
      targetBusinessId: businessId,
      details,
    });

    try {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch {
      /* ignore */
    }
    await ctx.reply("✅ Магазин отключён", {
      reply_markup: adminMainMenuKeyboard(),
    });
    await notifyAdminActionDone(ctx, {
      action: AdminActionType.DELETE_SHOP,
      businessId,
      atIso: at.toISOString(),
    });
    return true;
  }

  if (raw === CB_LIST) {
    await ctx.answerCbQuery().catch(() => undefined);
    const rows = await prisma.business.findMany({
      orderBy: { id: "asc" },
      take: 80,
      select: {
        id: true,
        name: true,
        isActive: true,
        isBlocked: true,
        subscriptionStatus: true,
        memberships: {
          where: { role: MembershipRole.OWNER },
          take: 1,
          select: { user: { select: { telegramId: true } } },
        },
      },
    });

    const lines: string[] = ["📋 Магазины:"];
    for (const b of rows) {
      const ownerTg =
        b.memberships[0]?.user?.telegramId != null
          ? b.memberships[0]!.user!.telegramId
          : "—";
      lines.push(
        `— #${b.id} «${b.name}» | ${formatBusinessStatus(b)} | владелец: ${ownerTg}`,
      );
    }
    if (rows.length === 0) lines.push("(пусто)");

    const body = lines.join("\n");
    const chunks: string[] = [];
    for (let i = 0; i < body.length; i += 3500) {
      chunks.push(body.slice(i, i + 3500));
    }
    try {
      await ctx.editMessageText(chunks[0] ?? body);
    } catch {
      await ctx.reply(chunks[0] ?? body);
    }
    for (let c = 1; c < chunks.length; c++) {
      await ctx.reply(chunks[c]!);
    }

    const quickSlice = rows.slice(0, 20);
    if (quickSlice.length > 0) {
      const quickKb: Array<Array<{ text: string; callback_data: string }>> = [];
      for (const b of quickSlice) {
        quickKb.push([
          { text: `❌ ${b.id}`, callback_data: `rpadm_qdi_${b.id}` },
          { text: `🔄 ${b.id}`, callback_data: `rpadm_qpx_${b.id}` },
        ]);
      }
      quickKb.push(...navBackMenuKeyboard().inline_keyboard);
      await ctx.reply("⚡️ Быстрые действия (первые 20 из списка):", {
        reply_markup: { inline_keyboard: quickKb },
      });
    } else {
      await sendAdminMenu(ctx);
    }
    return true;
  }

  if (raw === CB_DISABLE) {
    await ctx.answerCbQuery().catch(() => undefined);
    clearAdminOpsState(ap);
    ap.inputMode = "disable_id";
    try {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch {
      /* ignore */
    }
    await ctx.reply("Введите ID магазина для отключения:", {
      reply_markup: navBackMenuKeyboard(),
    });
    return true;
  }

  if (raw === CB_EXTEND) {
    await ctx.answerCbQuery().catch(() => undefined);
    clearAdminOpsState(ap);
    ap.inputMode = "extend_id";
    try {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch {
      /* ignore */
    }
    await ctx.reply("Введите ID магазина для продления подписки:", {
      reply_markup: navBackMenuKeyboard(),
    });
    return true;
  }

  const extMatch = /^rpadm_ext_(30|90)_(\d+)_([a-f0-9]{32})$/.exec(raw);
  if (extMatch) {
    const days = Number(extMatch[1]);
    const businessId = Number(extMatch[2]);
    const token = extMatch[3] ?? "";

    const tokenBad =
      ap.extendConsumeToken !== token ||
      ap.extendPendingBusinessId !== businessId ||
      token.length !== 32;

    if (tokenBad || !Number.isInteger(businessId) || businessId <= 0) {
      await ctx
        .answerCbQuery("Операция недействительна — запросите продление заново")
        .catch(() => undefined);
      delete ap.extendConsumeToken;
      delete ap.extendPendingBusinessId;
      return true;
    }

    delete ap.extendConsumeToken;
    delete ap.extendPendingBusinessId;

    const bBefore = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        isActive: true,
        isBlocked: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
      },
    });

    if (!bBefore) {
      await ctx.answerCbQuery("Магазин не найден").catch(() => undefined);
      await ctx.reply("❌ Магазин не найден", {
        reply_markup: adminMainMenuKeyboard(),
      });
      return true;
    }

    const now = Date.now();
    const base =
      bBefore.subscriptionEndsAt != null &&
      bBefore.subscriptionEndsAt.getTime() > now
        ? bBefore.subscriptionEndsAt
        : new Date(now);
    const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

    await prisma.business.update({
      where: { id: businessId },
      data: {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        subscriptionEndsAt: next,
      },
    });

    const at = new Date();
    const details = {
      ...previousStatusPayload(bBefore),
      daysAdded: days,
      previousSubscriptionEndsAt:
        bBefore.subscriptionEndsAt != null
          ? bBefore.subscriptionEndsAt.toISOString()
          : null,
      newSubscriptionEndsAt: next.toISOString(),
    };

    await persistAdminActionLog({
      adminTelegramId: tidStr,
      action: AdminActionType.EXTEND_SUBSCRIPTION,
      targetBusinessId: businessId,
      details,
    });

    await ctx.answerCbQuery().catch(() => undefined);
    try {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch {
      /* ignore */
    }
    await ctx.reply("✅ Подписка продлена", {
      reply_markup: adminMainMenuKeyboard(),
    });
    await notifyAdminActionDone(ctx, {
      action: AdminActionType.EXTEND_SUBSCRIPTION,
      businessId,
      atIso: at.toISOString(),
    });
    return true;
  }

  await ctx.answerCbQuery().catch(() => undefined);
  return true;
}
