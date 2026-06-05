import type { Prisma } from "@prisma/client";
import {
  AdminActionType,
  MembershipRole,
  RegistrationStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { bot as mainTelegrafBot } from "../bot/bot.js";
import { launchClientBot } from "../bot/launchClientBot.js";
import {
  getDynamicOwnerBot,
  stopDynamicStoreBotInMemory,
} from "../bot/dynamicBots.js";
import { applyBusinessTemplate } from "./applyBusinessTemplate.js";
import { prisma } from "./db.js";
import {
  plainBotTokenFromStored,
  hashBotTokenSha256Hex,
} from "./businessBotToken.js";
import { isEncryptedTokenFormat } from "./botTokenCrypto.js";
import { isPlatformOperator } from "./adminAuth.js";
import { mapRowsWithWebhook } from "./platformMyBusinesses.js";
import { provisionMerchantStoreInTx } from "./merchantProvision.js";
import { extendBusinessSubscription } from "./saasBillingService.js";
import {
  finikRegistrationComplete,
  finikRegistrationAdminLine,
} from "../shared/finikRegistration.js";
import {
  finikHasAccountId,
  finikHasApiKey,
  isFinikCredentialsReady,
} from "../shared/finikReady.js";

function buildApproveUserNotifyMessage(merchantBotUsername: string | null): string {
  let text =
    "🎉 Ваш магазин готов!\n\n" +
    "Теперь вы можете открыть своего бота и начать работу.\n\n" +
    "Нажмите /start в вашем боте и откройте магазин.\n\n";
  if (merchantBotUsername != null && merchantBotUsername !== "") {
    text += `🔗 https://t.me/${merchantBotUsername}\n\n`;
  }
  text += "Удачи 🚀";
  return text;
}

function buildRejectUserNotifyMessage(
  storeName: string,
  rejectReason: string | null,
): string {
  let text =
    `Заявка на магазин «${storeName}» отклонена.\n\n`;
  if (rejectReason != null && rejectReason.trim() !== "") {
    text += `Причина: ${rejectReason.trim()}\n\n`;
  }
  text +=
    "Вы можете подать новую заявку в Mini App — нажмите «Открыть Mini App» в боте.";
  return text;
}

async function notifyRegistrationRejectedUser(
  telegramId: string,
  storeName: string,
  rejectReason: string | null,
): Promise<void> {
  if (!/^\d+$/.test(telegramId)) {
    console.warn("[platformAdmin] skip reject notify: invalid telegramId");
    return;
  }
  if (!mainTelegrafBot) {
    console.warn(
      "[platformAdmin] main bot unavailable — reject notify skipped:",
      telegramId,
    );
    return;
  }
  try {
    await mainTelegrafBot.telegram.sendMessage(
      telegramId,
      buildRejectUserNotifyMessage(storeName, rejectReason),
    );
  } catch (e) {
    console.error(
      "[platformAdmin] reject notify sendMessage:",
      telegramId,
      e,
    );
  }
}

async function notifyRegistrationApprovedUser(
  telegramId: string,
  merchantBotUsername: string | null,
): Promise<void> {
  if (!/^\d+$/.test(telegramId)) {
    console.warn("[platformAdmin] skip notify: invalid telegramId");
    return;
  }
  if (!mainTelegrafBot) {
    console.warn(
      "[platformAdmin] main bot unavailable (BOT_TOKEN / BOT_TOKENS) — user not notified:",
      telegramId,
    );
    return;
  }
  try {
    await mainTelegrafBot.telegram.sendMessage(
      telegramId,
      buildApproveUserNotifyMessage(merchantBotUsername),
    );
  } catch (e) {
    console.error(
      "[platformAdmin] approve notify sendMessage:",
      telegramId,
      e,
    );
  }
}

/**
 * Доступ к REST `/api/platform/admin/*`: после `requireTelegramAuth` (WebApp initData)
 * telegram id проверяется по `PLATFORM_OPERATOR_IDS` (fallback: `ADMIN_IDS`).
 */
export function isPlatformOperatorTelegramId(telegramId: string): boolean {
  const tid = telegramId.trim();
  if (!/^\d+$/.test(tid)) return false;
  return isPlatformOperator(tid);
}

/** Backward compatibility alias for existing imports/calls. */
export const isPlatformAdminTelegramId = isPlatformOperatorTelegramId;

export type PlatformAdminRequestRow = {
  id: number;
  storeName: string;
  phone: string;
  status: RegistrationStatus;
  createdAt: string;
  telegramId: string;
  ownerUsername: string | null;
  businessType: string;
  botUsername: string | null;
  finikHasApiKey: boolean;
  finikHasAccountId: boolean;
  finikRegistrationComplete: boolean;
  finikAdminLine: string;
};

export async function listPendingRegistrationRequestsForAdmin(): Promise<
  PlatformAdminRequestRow[]
> {
  const rows = await prisma.registrationRequest.findMany({
    where: { status: RegistrationStatus.PENDING },
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      createdAt: true,
      telegramId: true,
      ownerUsername: true,
      businessType: true,
      botUsername: true,
      finikApiKey: true,
      finikAccountId: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    storeName: r.name,
    phone: r.phone,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    telegramId: r.telegramId,
    ownerUsername: r.ownerUsername,
    businessType: r.businessType,
    botUsername: r.botUsername,
    finikHasApiKey: finikHasApiKey(r.finikApiKey),
    finikHasAccountId: finikHasAccountId(r.finikAccountId),
    finikRegistrationComplete: finikRegistrationComplete(r),
    finikAdminLine: finikRegistrationAdminLine(r),
  }));
}

export type ApproveOutcome =
  | { ok: true; businessId: number }
  | { ok: false; statusCode: number; message: string };

export async function approveRegistrationRequestById(
  requestId: number,
): Promise<ApproveOutcome> {
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return { ok: false, statusCode: 400, message: "Неверный requestId" };
  }

  const row = await prisma.registrationRequest.findUnique({
    where: { id: requestId },
  });

  if (!row || row.status !== RegistrationStatus.PENDING) {
    return {
      ok: false,
      statusCode: 404,
      message: "Заявка не найдена или уже обработана",
    };
  }

  const tokenHash = hashBotTokenSha256Hex(row.botToken.trim());
  const tokenInUse = await prisma.business.findUnique({
    where: { botTokenHash: tokenHash },
    select: { id: true },
  });
  if (tokenInUse) {
    return {
      ok: false,
      statusCode: 409,
      message: "Токен бота уже привязан к другому магазину",
    };
  }

  let businessId: number;

  try {
    businessId = await prisma.$transaction(async (tx) => {
      const conflict = await tx.business.findUnique({
        where: { botTokenHash: tokenHash },
        select: { id: true },
      });
      if (conflict) {
        throw new Error("TOKEN_CONFLICT");
      }

      const bid = await provisionMerchantStoreInTx(tx, {
        name: row.name,
        botToken: row.botToken.trim(),
        telegramId: row.telegramId,
        finikApiKey: row.finikApiKey,
        finikAccountId: row.finikAccountId,
        businessType: (row as any).businessType,
        addressLine: row.addressLine,
        city: row.city,
        latitude: row.latitude,
        longitude: row.longitude,
      });

      await tx.registrationRequest.update({
        where: { id: requestId },
        data: { status: RegistrationStatus.APPROVED },
      });

      return bid;
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "TOKEN_CONFLICT") {
      return {
        ok: false,
        statusCode: 409,
        message: "Токен бота уже занят",
      };
    }
    console.error("approveRegistrationRequestById:", e);
    return {
      ok: false,
      statusCode: 500,
      message: "Не удалось создать магазин",
    };
  }

  console.log("=== APPROVE START ===");
  console.log("BUSINESS CREATED:", businessId);

  try {
    await applyBusinessTemplate({
      prisma,
      businessId,
      businessType: (row as any).businessType,
    });
  } catch (e) {
    console.error("[platformAdmin] applyBusinessTemplate failed:", {
      requestId,
      businessId,
      err: e,
    });
  }

  const bizFromDb = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, botToken: true },
  });
  const storedToken = bizFromDb?.botToken ?? "";
  console.log(
    "TOKEN BEFORE DECRYPT:",
    `${String(storedToken).slice(0, 24)}…(len=${String(storedToken).length})`,
  );

  let tokenPlain = "";
  try {
    tokenPlain = plainBotTokenFromStored(storedToken);
  } catch (de: unknown) {
    console.error(
      "[platformAdmin] approve: TOKEN DECRYPT EXCEPTION:",
      businessId,
      de,
    );
  }
  console.log(
    "TOKEN AFTER DECRYPT:",
    tokenPlain === ""
      ? "(empty)"
      : `${tokenPlain.slice(0, 10)}…(len=${tokenPlain.length})`,
  );
  if (!tokenPlain || isEncryptedTokenFormat(tokenPlain.trim())) {
    console.error(
      "[platformAdmin] approve: token empty or still ciphertext-shaped after decrypt",
      businessId,
    );
  }

  console.log("LAUNCH BOT...");
  let merchantUsername: string | null = null;
  try {
    const launched =
      bizFromDb == null ? null : await launchClientBot(bizFromDb);
    if (launched == null) {
      console.error("[platformAdmin] approve: Business row missing", businessId);
    } else if (!launched.ok) {
      console.error(
        "[platformAdmin] approve: launchClientBot failed:",
        businessId,
        launched.error,
      );
    } else {
      merchantUsername =
        typeof launched.username === "string"
          ? launched.username.trim().replace(/^@/, "") || null
          : null;

      if (!getDynamicOwnerBot(businessId)) {
        console.error(
          "[platformAdmin] approve: no bot in memory after launchClientBot",
          businessId,
        );
      }
    }

    const telegramId = row.telegramId.trim();
    await notifyRegistrationApprovedUser(telegramId, merchantUsername);
  } catch (err: unknown) {
    console.error(
      "[platformAdmin] approve: launchClientBot / setWebhook:",
      businessId,
      err,
    );
  }

  return { ok: true, businessId };
}

export type RejectOutcome =
  | { ok: true }
  | { ok: false; statusCode: number; message: string };

export async function rejectRegistrationRequestById(
  requestId: number,
  rejectReason?: string,
): Promise<RejectOutcome> {
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return { ok: false, statusCode: 400, message: "Неверный requestId" };
  }

  const row = await prisma.registrationRequest.findUnique({
    where: { id: requestId },
  });

  if (!row || row.status !== RegistrationStatus.PENDING) {
    return {
      ok: false,
      statusCode: 404,
      message: "Заявка не найдена или уже обработана",
    };
  }

  const reasonTrimmed =
    typeof rejectReason === "string" ? rejectReason.trim().slice(0, 500) : "";

  await prisma.registrationRequest.update({
    where: { id: requestId },
    data: {
      status: RegistrationStatus.REJECTED,
      rejectReason: reasonTrimmed !== "" ? reasonTrimmed : null,
    },
  });

  await notifyRegistrationRejectedUser(
    row.telegramId.trim(),
    row.name,
    reasonTrimmed !== "" ? reasonTrimmed : null,
  );

  return { ok: true };
}

const MS_DAY = 24 * 60 * 60 * 1000;

/** Публичный список магазинов для Mini App `/platform-admin` (без `botToken` в JSON). */
export type PlatformAdminBusinessRow = {
  id: number;
  name: string;
  isActive: boolean;
  isBlocked: boolean;
  /** Сводный статус (как в кабинете клиента). */
  status: string;
  /** Есть действующее окно оплаты/trial (как в my-businesses). */
  subscriptionActive: boolean;
  subscriptionStatus: string;
  subscriptionEndsAt: string | null;
  trialEndsAt: string | null;
  webhookStatus: "OK" | "ERROR";
  webhookUrl: string | null;
  finikReady: boolean;
  finikHasApiKey: boolean;
  finikHasAccountId: boolean;
};

export async function listBusinessesForPlatformAdmin(
  searchRaw?: string,
): Promise<PlatformAdminBusinessRow[]> {
  const q = (searchRaw ?? "").trim().slice(0, 128);
  let where: Prisma.BusinessWhereInput = {};
  if (q !== "") {
    if (/^\d+$/.test(q)) {
      const id = Number(q);
      if (!Number.isInteger(id) || id <= 0) {
        return [];
      }
      where = { id };
    } else {
      where = { name: { contains: q, mode: "insensitive" } };
    }
  }

  const rows = await prisma.business.findMany({
    where,
    orderBy: { id: "asc" },
    take: q === "" ? 400 : 80,
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      isBlocked: true,
      subscriptionStatus: true,
      subscriptionEndsAt: true,
      trialEndsAt: true,
      botToken: true,
      finikApiKey: true,
      finikAccountId: true,
    },
  });

  const probed = await mapRowsWithWebhook(rows);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return probed.map((p) => {
    const r = byId.get(p.id);
    const finikReady = isFinikCredentialsReady(
      r?.finikApiKey,
      r?.finikAccountId,
    );
    return {
      id: p.id,
      name: p.name,
      isActive: p.isActive,
      isBlocked: p.isBlocked,
      status: p.status,
      subscriptionActive: p.subscriptionActive,
      subscriptionStatus: String(r?.subscriptionStatus ?? ""),
      subscriptionEndsAt: r?.subscriptionEndsAt?.toISOString() ?? null,
      trialEndsAt: r?.trialEndsAt?.toISOString() ?? null,
      webhookStatus: p.webhookStatus,
      webhookUrl: p.webhookUrl,
      finikReady,
      finikHasApiKey: finikHasApiKey(r?.finikApiKey),
      finikHasAccountId: finikHasAccountId(r?.finikAccountId),
    };
  });
}

export type ExtendBusinessOutcome =
  | { ok: true; subscriptionEndsAt: string }
  | { ok: false; statusCode: number; message: string };

const OPERATOR_EXTEND_DAYS = [7, 30, 90, 365] as const;
export type OperatorExtendDays = (typeof OPERATOR_EXTEND_DAYS)[number];

export function parseOperatorExtendDays(raw: unknown): OperatorExtendDays | null {
  const n =
    typeof raw === "number" && Number.isFinite(raw)
      ? Math.trunc(raw)
      : typeof raw === "string"
        ? Number(raw.trim())
        : NaN;
  return (OPERATOR_EXTEND_DAYS as readonly number[]).includes(n)
    ? (n as OperatorExtendDays)
    : null;
}

export async function extendBusinessSubscriptionAdmin(input: {
  businessId: number;
  operatorTelegramId: string;
  days?: OperatorExtendDays;
  extendToDate?: Date;
  note?: string;
}): Promise<ExtendBusinessOutcome> {
  const { businessId, operatorTelegramId } = input;
  if (!Number.isInteger(businessId) || businessId <= 0) {
    return { ok: false, statusCode: 400, message: "Неверный businessId" };
  }

  const row = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, subscriptionEndsAt: true },
  });
  if (!row) {
    return { ok: false, statusCode: 404, message: "Магазин не найден" };
  }

  const now = new Date();
  let accessDays: number;
  let note = input.note?.trim() ?? "";

  if (input.extendToDate != null) {
    const target = input.extendToDate;
    if (Number.isNaN(target.getTime())) {
      return { ok: false, statusCode: 400, message: "Некорректная дата" };
    }
    const base =
      row.subscriptionEndsAt != null &&
      row.subscriptionEndsAt.getTime() > now.getTime()
        ? row.subscriptionEndsAt
        : now;
    accessDays = Math.max(
      1,
      Math.ceil((target.getTime() - base.getTime()) / MS_DAY),
    );
    if (note === "") note = `extend_to:${target.toISOString()}`;
  } else if (input.days != null) {
    accessDays = input.days;
    if (note === "") note = `+${input.days}d`;
  } else {
    return {
      ok: false,
      statusCode: 400,
      message: "Укажите days (7, 30, 90, 365) или extendToDate",
    };
  }

  const ext = await prisma.$transaction(async (tx) => {
    const result = await extendBusinessSubscription({
      businessId,
      operatorDaysGranted: accessDays,
      source: "operator",
      now,
      tx,
    });
    if (result == null) {
      throw new Error("extend failed");
    }
    await tx.subscriptionManualExtension.create({
      data: {
        businessId,
        operatorTelegramId,
        daysAdded: accessDays,
        previousEndsAt: result.previousEndsAt,
        newEndsAt: result.subscriptionEndsAt,
        note: note || null,
      },
    });
    await tx.adminActionLog.create({
      data: {
        adminTelegramId: operatorTelegramId,
        action: AdminActionType.EXTEND_SUBSCRIPTION,
        targetBusinessId: businessId,
        details: {
          daysAdded: accessDays,
          previousSubscriptionEndsAt:
            result.previousEndsAt?.toISOString() ?? null,
          newSubscriptionEndsAt: result.subscriptionEndsAt.toISOString(),
          note: note || null,
        },
      },
    });
    return result;
  });

  return { ok: true, subscriptionEndsAt: ext.subscriptionEndsAt.toISOString() };
}

export async function listSubscriptionManualExtensionsAdmin(
  businessId: number,
): Promise<
  | {
      ok: true;
      rows: Array<{
        id: number;
        operatorTelegramId: string;
        daysAdded: number | null;
        previousEndsAt: string | null;
        newEndsAt: string;
        note: string | null;
        createdAt: string;
      }>;
    }
  | { ok: false; statusCode: number; message: string }
> {
  if (!Number.isInteger(businessId) || businessId <= 0) {
    return { ok: false, statusCode: 400, message: "Неверный businessId" };
  }
  const rows = await prisma.subscriptionManualExtension.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return {
    ok: true,
    rows: rows.map((r) => ({
      id: r.id,
      operatorTelegramId: r.operatorTelegramId,
      daysAdded: r.daysAdded,
      previousEndsAt: r.previousEndsAt?.toISOString() ?? null,
      newEndsAt: r.newEndsAt.toISOString(),
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

/** @deprecated Используйте extendBusinessSubscriptionAdmin с days. */
export async function extendBusinessSubscriptionAdminLegacy(
  businessId: number,
  days: 30 | 90,
  operatorTelegramId: string,
): Promise<ExtendBusinessOutcome> {
  return extendBusinessSubscriptionAdmin({
    businessId,
    operatorTelegramId,
    days: days === 30 ? 30 : 90,
  });
}

export type PurgeBusinessOutcome =
  | { ok: true }
  | { ok: false; statusCode: number; message: string };

type PurgedBusinessMeta = {
  id: number;
  name: string;
  slug: string | null;
};

/**
 * Удаляет магазин и связанные строки из БД (без проверки ролей и без лога).
 */
async function purgeBusinessFromDatabase(
  businessId: number,
): Promise<
  | { ok: true; biz: PurgedBusinessMeta }
  | { ok: false; statusCode: number; message: string }
> {
  if (!Number.isInteger(businessId) || businessId <= 0) {
    return { ok: false, statusCode: 400, message: "Неверный businessId" };
  }

  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      slug: true,
      botToken: true,
    },
  });
  if (!biz) {
    return { ok: false, statusCode: 404, message: "Магазин не найден" };
  }

  const requestPlainTok = plainBotTokenFromStored(biz.botToken);

  await stopDynamicStoreBotInMemory(businessId);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.deleteMany({ where: { businessId } });
      await tx.product.deleteMany({ where: { businessId } });
      await tx.category.deleteMany({ where: { businessId } });
      await tx.promo.deleteMany({ where: { businessId } });
      await tx.paymentRequest.deleteMany({ where: { businessId } });
      await tx.subscriptionFinikPayment.deleteMany({ where: { businessId } });
      await tx.merchantChangeRequest.deleteMany({ where: { businessId } });
      await tx.membership.deleteMany({ where: { businessId } });
      await tx.settings.deleteMany({ where: { businessId } });
      await tx.adminActionLog.deleteMany({
        where: { targetBusinessId: businessId },
      });
      await tx.registrationRequest.deleteMany({
        where: { botToken: requestPlainTok },
      });
      await tx.business.delete({ where: { id: businessId } });
    });
  } catch (e) {
    console.error("[purgeBusinessFromDatabase]", businessId, e);
    return {
      ok: false,
      statusCode: 500,
      message: "Не удалось удалить данные из БД",
    };
  }

  return {
    ok: true,
    biz: { id: biz.id, name: biz.name, slug: biz.slug },
  };
}

/**
 * Полное удаление магазина владельцем (только роль OWNER в этом магазине).
 */
export async function purgeBusinessCompletelyForOwner(
  businessId: number,
  ownerTelegramId: string,
): Promise<PurgeBusinessOutcome> {
  const tid = ownerTelegramId.trim();
  if (!/^\d+$/.test(tid)) {
    return { ok: false, statusCode: 400, message: "Некорректный Telegram ID" };
  }

  const user = await prisma.user.findUnique({
    where: { telegramId: tid },
    select: { id: true },
  });
  if (!user) {
    return { ok: false, statusCode: 403, message: "Пользователь не найден" };
  }

  const owns = await prisma.businessStaff.findFirst({
    where: {
      businessId,
      userId: user.id,
      role: "OWNER",
    },
    select: { id: true },
  });
  if (!owns) {
    return {
      ok: false,
      statusCode: 403,
      message: "Удалить магазин может только владелец",
    };
  }

  const purged = await purgeBusinessFromDatabase(businessId);
  if (!purged.ok) return purged;

  try {
    await prisma.adminActionLog.create({
      data: {
        adminTelegramId: tid,
        action: AdminActionType.DELETE_SHOP,
        targetBusinessId: businessId,
        details: {
          purgeComplete: true,
          selfServiceOwner: true,
          previousName: purged.biz.name,
          previousSlug: purged.biz.slug,
        } as object,
      },
    });
  } catch (logErr) {
    console.error("[purgeBusinessCompletelyForOwner] AdminActionLog:", logErr);
  }

  return { ok: true };
}

/**
 * Полное удаление магазина и связанных данных из БД (порядок с учётом FK Product→Category).
 * Пользователи `User` не удаляются (глобальные аккаунты).
 */
export async function purgeBusinessCompletelyForPlatformAdmin(
  businessId: number,
  adminTelegramId: string,
): Promise<PurgeBusinessOutcome> {
  const purged = await purgeBusinessFromDatabase(businessId);
  if (!purged.ok) return purged;

  try {
    await prisma.adminActionLog.create({
      data: {
        adminTelegramId,
        action: AdminActionType.DELETE_SHOP,
        targetBusinessId: businessId,
        details: {
          purgeComplete: true,
          previousName: purged.biz.name,
          previousSlug: purged.biz.slug,
        } as object,
      },
    });
  } catch (logErr) {
    console.error(
      "[purgeBusinessCompletelyForPlatformAdmin] AdminActionLog:",
      logErr,
    );
  }

  return { ok: true };
}
