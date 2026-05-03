import { RegistrationStatus } from "@prisma/client";
import { prisma } from "./db.js";
import { cleanInput, validateKgPhone } from "./orderInputSanitize.js";
import { isValidFinikApiKey } from "../bot/saasRegistrationValidation.js";
import {
  MSG_BOT_ALREADY_REGISTERED,
  precheckBotTokenBeforeRegistrationPersist,
} from "./registrationTokenGate.js";

export const PLATFORM_STORE_NAME_MIN = 2;
export const PLATFORM_STORE_NAME_MAX = 160;

export type PlatformRegisterBody = {
  storeName?: unknown;
  botToken?: unknown;
  phone?: unknown;
  telegramId?: unknown;
  finikApiKey?: unknown;
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
    typeof body.botToken === "string" ? body.botToken.replace(/\s/g, "").trim() : "";
  const tokenGate = await precheckBotTokenBeforeRegistrationPersist(botToken);
  if (!tokenGate.ok) {
    return {
      ok: false,
      statusCode:
        tokenGate.error === MSG_BOT_ALREADY_REGISTERED ? 409 : 400,
      error: tokenGate.error,
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

  const finikRaw = typeof body.finikApiKey === "string" ? body.finikApiKey : "";
  if (!isValidFinikApiKey(finikRaw)) {
    return {
      ok: false,
      statusCode: 400,
      error: "Некорректный API-ключ Finik",
    };
  }
  const finikApiKeyTrimmed = finikRaw.trim();

  const telegramId = normalizeTelegramId(body.telegramId);
  if (!telegramId) {
    return {
      ok: false,
      statusCode: 400,
      error: "Нужен корректный telegramId",
    };
  }

  const pendingSameUser = await prisma.registrationRequest.findFirst({
    where: {
      telegramId,
      status: RegistrationStatus.PENDING,
    },
    select: { id: true },
  });
  if (pendingSameUser) {
    return {
      ok: false,
      statusCode: 409,
      error: "У вас уже есть заявка на рассмотрении",
    };
  }

  const gateAgain = await precheckBotTokenBeforeRegistrationPersist(botToken);
  if (!gateAgain.ok) {
    return {
      ok: false,
      statusCode:
        gateAgain.error === MSG_BOT_ALREADY_REGISTERED ? 409 : 400,
      error: gateAgain.error,
    };
  }

  try {
    const row = await prisma.registrationRequest.create({
      data: {
        name: storeRaw,
        botToken,
        phone,
        finikApiKey: finikApiKeyTrimmed,
        telegramId,
        status: RegistrationStatus.PENDING,
      },
      select: { id: true },
    });
    return { ok: true, id: row.id };
  } catch {
    return {
      ok: false,
      statusCode: 500,
      error: "Не удалось сохранить заявку",
    };
  }
}
