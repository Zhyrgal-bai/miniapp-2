import type { Prisma } from "@prisma/client";
import {
  BillingPlan,
  MembershipRole,
  RegistrationStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { bot as mainTelegrafBot } from "../bot/bot.js";
import {
  getDynamicOwnerBot,
  initDynamicStoreBot,
} from "../bot/dynamicBots.js";
import { prisma } from "./db.js";

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
  },
): Promise<number> {
  const slug = `shop-${params.slugSuffix}`;
  const trialEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  const botTok = params.botToken.trim();
  const finikTrimmed = params.finikApiKey?.trim();
  const useFinik = finikTrimmed != null && finikTrimmed.length > 0;

  const business = await tx.business.create({
    data: {
      name: params.name.trim(),
      slug,
      botToken: botTok,
      finikApiKey: useFinik ? finikTrimmed! : null,
      isActive: true,
      isBlocked: false,
      subscriptionStatus: SubscriptionStatus.TRIALING,
      billingPlan: BillingPlan.FREE,
      trialEndsAt: trialEnd,
    },
  });

  await tx.settings.create({
    data: {
      businessId: business.id,
      paymentProvider: useFinik ? "finik" : null,
    },
  });

  const ownerUser = await tx.user.upsert({
    where: { telegramId: params.telegramId },
    update: { name: normalizeStoreName(params.name) },
    create: {
      telegramId: params.telegramId,
      name: normalizeStoreName(params.name),
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

function platformAdminEnvId(): string | null {
  const raw = String(process.env.PLATFORM_ADMIN_TELEGRAM_ID ?? "").trim();
  return /^\d+$/.test(raw) ? raw : null;
}

export function isPlatformAdminTelegramId(telegramId: string): boolean {
  const admin = platformAdminEnvId();
  if (!admin) return false;
  return telegramId === admin;
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

  const tokenInUse = await prisma.business.findUnique({
    where: { botToken: row.botToken.trim() },
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
        where: { botToken: row.botToken.trim() },
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

  const botTokenTrimmed = row.botToken.trim();

  try {
    const started = await initDynamicStoreBot({
      businessId,
      botToken: botTokenTrimmed,
    });
    const merchantUsername =
      typeof started.username === "string"
        ? started.username.trim().replace(/^@/, "") || null
        : null;

    const storeBot = getDynamicOwnerBot(businessId);
    if (!storeBot) {
      console.error(
        "[platformAdmin] approve: no bot in memory after initDynamicStoreBot",
        businessId,
      );
    } else {
      const base = String(process.env.BASE_URL ?? "").trim().replace(/\/$/, "");
      if (base !== "") {
        const webhookUrl = `${base}/webhook/${businessId}`;
        await storeBot.telegram.setWebhook(webhookUrl);
      }
      console.log("Bot started:", businessId);
    }

    const telegramId = row.telegramId.trim();
    await notifyRegistrationApprovedUser(telegramId, merchantUsername);
  } catch (err: unknown) {
    console.error(
      "[platformAdmin] approve: initDynamicStoreBot / setWebhook:",
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
