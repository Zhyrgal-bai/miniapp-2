import { RegistrationStatus } from "@prisma/client";
import { prisma } from "./db.js";
import { cleanInput, validateKgPhone } from "./orderInputSanitize.js";

export const PLATFORM_STORE_NAME_MIN = 2;
export const PLATFORM_STORE_NAME_MAX = 160;

/** Типичный формат BotFather: `<bot_id>:<secret>`. */
const BOT_TOKEN_BASIC_RE = /^\d{6,22}:[A-Za-z0-9_-]{25,}$/;

export type PlatformRegisterBody = {
  storeName?: unknown;
  botToken?: unknown;
  phone?: unknown;
  telegramId?: unknown;
};

export type PlatformRegisterResult =
  | { ok: true; id: number }
  | { ok: false; statusCode: number; error: string };

function normalizeTelegramId(raw: unknown): string | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    const n = Math.trunc(raw);
    if (!Number.isSafeInteger(n)) return null;
    return String(n);
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    return /^\d+$/.test(t) ? t : null;
  }
  return null;
}

export async function validateAndPersistPlatformRegistration(
  body: PlatformRegisterBody,
): Promise<PlatformRegisterResult> {
  const storeRaw = typeof body.storeName === "string" ? cleanInput(body.storeName) : "";
  if (
    storeRaw.length < PLATFORM_STORE_NAME_MIN ||
    storeRaw.length > PLATFORM_STORE_NAME_MAX
  ) {
    return {
      ok: false,
      statusCode: 400,
      error: `Название магазина: от ${PLATFORM_STORE_NAME_MIN} до ${PLATFORM_STORE_NAME_MAX} символов`,
    };
  }

  const botToken =
    typeof body.botToken === "string" ? body.botToken.trim() : "";
  if (!BOT_TOKEN_BASIC_RE.test(botToken)) {
    return {
      ok: false,
      statusCode: 400,
      error: "Неверный формат токена бота",
    };
  }

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!validateKgPhone(phone)) {
    return {
      ok: false,
      statusCode: 400,
      error: "Неверный номер телефона (ожидается KG: +996… или 0…)",
    };
  }

  const telegramId = normalizeTelegramId(body.telegramId);
  if (!telegramId) {
    return {
      ok: false,
      statusCode: 400,
      error: "Нужен корректный telegramId",
    };
  }

  const row = await prisma.registrationRequest.create({
    data: {
      name: storeRaw,
      botToken,
      phone,
      telegramId,
      status: RegistrationStatus.PENDING,
    },
    select: { id: true },
  });

  return { ok: true, id: row.id };
}
