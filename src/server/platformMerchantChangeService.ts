import {
  encryptedBotTokenRow,
  hashBotTokenSha256Hex,
  plainBotTokenFromStored,
} from "./businessBotToken.js";
import { prisma } from "./db.js";
import { bot as mainTelegrafBot } from "../bot/bot.js";
import {
  initDynamicStoreBot,
  stopDynamicStoreBotInMemory,
} from "../bot/dynamicBots.js";
import { precheckBotTokenBeforeRegistrationPersist } from "./registrationTokenGate.js";

export const MERCHANT_CHANGE_TYPE_BOT_TOKEN = "BOT_TOKEN_CHANGE";
export const MERCHANT_CHANGE_STATUS_PENDING = "PENDING";
export const MERCHANT_CHANGE_STATUS_APPROVED = "APPROVED";
export const MERCHANT_CHANGE_STATUS_REJECTED = "REJECTED";

export type MerchantChangeRequestListRow = {
  id: number;
  businessId: number;
  storeName: string;
  requesterTelegramId: string;
  createdAt: string;
};

function adminTelegramIdsFromEnv(): string[] {
  const raw = process.env.ADMIN_IDS;
  if (!raw) return [];
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s));
}

export async function notifyAdminsNewBotTokenChangeRequest(input: {
  id: number;
  businessId: number;
  storeName: string;
}): Promise<void> {
  const admins = adminTelegramIdsFromEnv();
  if (admins.length === 0 || !mainTelegrafBot) return;
  const text = [
    "🔑 Новая заявка на смену botToken",
    `ID заявки: ${input.id}`,
    `Магазин: #${input.businessId} «${input.storeName}»`,
    "Откройте админ-панель рег-бота → «Смены токена» или Mini App админа.",
  ].join("\n");
  for (const aid of admins) {
    try {
      await mainTelegrafBot.telegram.sendMessage(aid, text);
    } catch (e) {
      console.error("[platformMerchantChange] notify admin:", aid, e);
    }
  }
}

export async function notifyRequesterBotTokenChangeOutcome(input: {
  requesterTelegramId: string;
  approved: boolean;
  businessId: number;
}): Promise<void> {
  if (!/^\d+$/.test(input.requesterTelegramId.trim()) || !mainTelegrafBot) {
    return;
  }
  const text = input.approved
    ? `✅ Заявка на смену токена бота для магазина #${input.businessId} одобрена. Бот перезапущен.`
    : `❌ Заявка на смену токена бота для магазина #${input.businessId} отклонена.`;
  try {
    await mainTelegrafBot.telegram.sendMessage(input.requesterTelegramId.trim(), text);
  } catch (e) {
    console.error("[platformMerchantChange] notify requester:", e);
  }
}

export async function listPendingMerchantChangeRequests(): Promise<
  MerchantChangeRequestListRow[]
> {
  const rows = await prisma.merchantChangeRequest.findMany({
    where: {
      type: MERCHANT_CHANGE_TYPE_BOT_TOKEN,
      status: MERCHANT_CHANGE_STATUS_PENDING,
    },
    orderBy: { id: "asc" },
    include: {
      business: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    businessId: r.businessId,
    storeName: r.business.name,
    requesterTelegramId: r.requesterTelegramId,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createMerchantBotTokenChangeRequest(input: {
  businessId: number;
  requesterTelegramId: string;
  newBotToken: string;
}): Promise<
  | { ok: true; id: number }
  | { ok: false; statusCode: number; error: string }
> {
  const tid = input.requesterTelegramId.trim();
  if (!/^\d+$/.test(tid)) {
    return { ok: false, statusCode: 400, error: "Некорректный requester" };
  }
  const token = input.newBotToken.replace(/\s/g, "").trim();
  if (token === "") {
    return { ok: false, statusCode: 400, error: "Нужен новый botToken" };
  }

  const business = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: { id: true, botToken: true, name: true },
  });
  if (business == null) {
    return { ok: false, statusCode: 404, error: "Магазин не найден" };
  }
  if (plainBotTokenFromStored(business.botToken) === token) {
    return {
      ok: false,
      statusCode: 400,
      error: "Новый токен совпадает с текущим",
    };
  }

  const pendingSame = await prisma.merchantChangeRequest.findFirst({
    where: {
      businessId: input.businessId,
      type: MERCHANT_CHANGE_TYPE_BOT_TOKEN,
      status: MERCHANT_CHANGE_STATUS_PENDING,
    },
    select: { id: true },
  });
  if (pendingSame) {
    return {
      ok: false,
      statusCode: 409,
      error: "Уже есть заявка на смену токена для этого магазина",
    };
  }

  const gate = await precheckBotTokenBeforeRegistrationPersist(token);
  if (!gate.ok) {
    return {
      ok: false,
      statusCode: gate.error.includes("уже") ? 409 : 400,
      error: gate.error,
    };
  }

  const pendingOther = await prisma.merchantChangeRequest.findFirst({
    where: {
      newBotToken: token,
      status: MERCHANT_CHANGE_STATUS_PENDING,
      NOT: { businessId: input.businessId },
    },
    select: { id: true },
  });
  if (pendingOther) {
    return {
      ok: false,
      statusCode: 409,
      error: "Этот токен уже указан в другой ожидающей заявке",
    };
  }

  const row = await prisma.merchantChangeRequest.create({
    data: {
      type: MERCHANT_CHANGE_TYPE_BOT_TOKEN,
      businessId: input.businessId,
      newBotToken: token,
      requesterTelegramId: tid,
      status: MERCHANT_CHANGE_STATUS_PENDING,
    },
  });

  void notifyAdminsNewBotTokenChangeRequest({
    id: row.id,
    businessId: business.id,
    storeName: business.name,
  });

  return { ok: true, id: row.id };
}

export async function approveMerchantBotTokenChangeById(
  requestId: number,
): Promise<
  | { ok: true; businessId: number }
  | { ok: false; statusCode: number; message: string }
> {
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return { ok: false, statusCode: 400, message: "Неверный id" };
  }

  const row = await prisma.merchantChangeRequest.findUnique({
    where: { id: requestId },
    include: { business: { select: { id: true, botToken: true } } },
  });
  if (
    row == null ||
    row.status !== MERCHANT_CHANGE_STATUS_PENDING ||
    row.type !== MERCHANT_CHANGE_TYPE_BOT_TOKEN
  ) {
    return {
      ok: false,
      statusCode: 404,
      message: "Заявка не найдена или уже обработана",
    };
  }

  const newTok = row.newBotToken.trim();
  const conflict = await prisma.business.findFirst({
    where: {
      botTokenHash: hashBotTokenSha256Hex(newTok),
      NOT: { id: row.businessId },
    },
    select: { id: true },
  });
  if (conflict) {
    return {
      ok: false,
      statusCode: 409,
      message: "Токен уже занят другим магазином",
    };
  }

  await stopDynamicStoreBotInMemory(row.businessId);

  try {
    await prisma.$transaction([
      prisma.business.update({
        where: { id: row.businessId },
        data: encryptedBotTokenRow(newTok),
      }),
      prisma.merchantChangeRequest.update({
        where: { id: requestId },
        data: { status: MERCHANT_CHANGE_STATUS_APPROVED },
      }),
    ]);
  } catch (e) {
    console.error("approveMerchantBotTokenChangeById tx:", e);
    return {
      ok: false,
      statusCode: 500,
      message: "Не удалось обновить токен",
    };
  }

  try {
    await initDynamicStoreBot({
      businessId: row.businessId,
      botToken: newTok,
    });
  } catch (e) {
    console.error(
      "approveMerchantBotTokenChangeById initDynamicStoreBot:",
      row.businessId,
      e,
    );
    return {
      ok: false,
      statusCode: 500,
      message: "Токен записан, но не удалось запустить бота — проверьте логи",
    };
  }

  void notifyRequesterBotTokenChangeOutcome({
    requesterTelegramId: row.requesterTelegramId,
    approved: true,
    businessId: row.businessId,
  });

  return { ok: true, businessId: row.businessId };
}

export async function rejectMerchantBotTokenChangeById(
  requestId: number,
): Promise<{ ok: true } | { ok: false; statusCode: number; message: string }> {
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return { ok: false, statusCode: 400, message: "Неверный id" };
  }

  const row = await prisma.merchantChangeRequest.findUnique({
    where: { id: requestId },
  });
  if (
    row == null ||
    row.status !== MERCHANT_CHANGE_STATUS_PENDING ||
    row.type !== MERCHANT_CHANGE_TYPE_BOT_TOKEN
  ) {
    return {
      ok: false,
      statusCode: 404,
      message: "Заявка не найдена или уже обработана",
    };
  }

  await prisma.merchantChangeRequest.update({
    where: { id: requestId },
    data: { status: MERCHANT_CHANGE_STATUS_REJECTED },
  });

  void notifyRequesterBotTokenChangeOutcome({
    requesterTelegramId: row.requesterTelegramId,
    approved: false,
    businessId: row.businessId,
  });

  return { ok: true };
}
