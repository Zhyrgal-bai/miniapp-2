import type { Prisma } from "@prisma/client";
import {
  AdminActionType,
  BillingPlan,
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
  encryptedBotTokenRow,
  plainBotTokenFromStored,
  hashBotTokenSha256Hex,
} from "./businessBotToken.js";
import { isEncryptedTokenFormat } from "./botTokenCrypto.js";
import { isAdmin } from "./adminAuth.js";
import { mapRowsWithWebhook } from "./platformMyBusinesses.js";

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

function normalizeStoreName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Копия логики из `saasRegistration.provisionMerchantStoreInTx`. */
async function provisionMerchantStoreInTx(
  tx: Prisma.TransactionClient,
  params: {
    name: string;
    botToken: string;
    telegramId: string;
    slugSuffix: string;
    finikApiKey?: string | null;
    businessType?: string;
  },
): Promise<number> {
  const slug = `shop-${params.slugSuffix}`;
  const botTok = params.botToken.trim();
  const tokenFields = encryptedBotTokenRow(botTok);
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
      botToken: tokenFields.botToken,
      botTokenHash: tokenFields.botTokenHash,
      finikApiKey: useFinik ? finikTrimmed! : null,
      businessType:
        params.businessType === "coffee" ||
        params.businessType === "fastfood" ||
        params.businessType === "flowers"
          ? (params.businessType as any)
          : ("clothing" as any),
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

/**
 * Доступ к REST `/api/platform/admin/*`: после `requireTelegramAuth` (WebApp initData)
 * telegram id проверяется по `ADMIN_IDS` на сервере.
 */
export function isPlatformAdminTelegramId(telegramId: string): boolean {
  const tid = telegramId.trim();
  if (!/^\d+$/.test(tid)) return false;
  return isAdmin(tid);
}

export type PlatformAdminRequestRow = {
  id: number;
  storeName: string;
  phone: string;
  status: RegistrationStatus;
  createdAt: string;
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
    },
  });
  return rows.map((r) => ({
    id: r.id,
    storeName: r.name,
    phone: r.phone,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
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
        slugSuffix: `${requestId}-${Date.now().toString(36)}`,
        finikApiKey: row.finikApiKey,
        businessType: (row as any).businessType,
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

  await prisma.registrationRequest.update({
    where: { id: requestId },
    data: { status: RegistrationStatus.REJECTED },
  });

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
      isActive: true,
      isBlocked: true,
      subscriptionStatus: true,
      subscriptionEndsAt: true,
      trialEndsAt: true,
      botToken: true,
    },
  });

  const probed = await mapRowsWithWebhook(rows);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return probed.map((p) => {
    const r = byId.get(p.id);
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
    };
  });
}

export type ExtendBusinessOutcome =
  | { ok: true; subscriptionEndsAt: string }
  | { ok: false; statusCode: number; message: string };

export async function extendBusinessSubscriptionAdmin(
  businessId: number,
  days: 30 | 90,
): Promise<ExtendBusinessOutcome> {
  if (!Number.isInteger(businessId) || businessId <= 0) {
    return { ok: false, statusCode: 400, message: "Неверный businessId" };
  }
  if (days !== 30 && days !== 90) {
    return { ok: false, statusCode: 400, message: "Нужно 30 или 90 дней" };
  }

  const row = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, subscriptionEndsAt: true },
  });
  if (!row) {
    return { ok: false, statusCode: 404, message: "Магазин не найден" };
  }

  const now = Date.now();
  const base =
    row.subscriptionEndsAt != null &&
    row.subscriptionEndsAt.getTime() > now
      ? row.subscriptionEndsAt
      : new Date(now);
  const next = new Date(base.getTime() + days * MS_DAY);

  await prisma.business.update({
    where: { id: businessId },
    data: {
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      subscriptionEndsAt: next,
    },
  });

  return { ok: true, subscriptionEndsAt: next.toISOString() };
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

  const owns = await prisma.membership.findFirst({
    where: {
      businessId,
      userId: user.id,
      role: MembershipRole.OWNER,
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
