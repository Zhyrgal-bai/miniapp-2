import { RegistrationStatus } from "@prisma/client";
import { prisma } from "./db.js";
import { cleanInput, validateKgPhone } from "./orderInputSanitize.js";
import { parseFinikRegistrationFields } from "../shared/finikRegistration.js";
import {
  fetchTelegramBotGetMe,
  MSG_BOT_ALREADY_REGISTERED,
  precheckBotTokenBeforeRegistrationPersist,
} from "./registrationTokenGate.js";
import {
  normalizeRegistrationBusinessType,
  type TargetBusinessTypeId,
} from "../shared/businessTypes.js";
import {
  parseBusinessAddressInput,
  type BusinessAddressInput,
} from "../shared/businessAddress.js";

export const PLATFORM_STORE_NAME_MIN = 2;
export const PLATFORM_STORE_NAME_MAX = 160;

export type PlatformRegisterBody = {
  storeName?: unknown;
  botToken?: unknown;
  phone?: unknown;
  telegramId?: unknown;
  businessType?: unknown;
  ownerUsername?: unknown;
  finikApiKey?: unknown;
  finikAccountId?: unknown;
  addressLine?: unknown;
  city?: unknown;
  latitude?: unknown;
  longitude?: unknown;
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

function normalizeBusinessType(raw: unknown): TargetBusinessTypeId {
  return normalizeRegistrationBusinessType(raw);
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

  const finikParsed = parseFinikRegistrationFields({
    finikApiKey:
      typeof body.finikApiKey === "string" ? body.finikApiKey : null,
    finikAccountId:
      typeof body.finikAccountId === "string" ? body.finikAccountId : null,
  });
  if (!finikParsed.ok) {
    return { ok: false, statusCode: 400, error: finikParsed.error };
  }

  const telegramId = normalizeTelegramId(body.telegramId);
  if (!telegramId) {
    return {
      ok: false,
      statusCode: 400,
      error: "Нужен корректный telegramId",
    };
  }

  const addressParsed = parseBusinessAddressInput({
    addressLine: body.addressLine,
    city: body.city,
    latitude: body.latitude,
    longitude: body.longitude,
  } satisfies BusinessAddressInput);
  if (!addressParsed.ok) {
    return { ok: false, statusCode: 400, error: addressParsed.error };
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
    const businessType = normalizeBusinessType(body.businessType);
    const getMe = await fetchTelegramBotGetMe(botToken);
    const botUsername = getMe.username;
    const ownerUsername =
      typeof body.ownerUsername === "string"
        ? body.ownerUsername.trim().replace(/^@/, "").slice(0, 64) || null
        : null;

    const row = await prisma.registrationRequest.create({
      data: {
        name: storeRaw,
        botToken,
        phone,
        finikApiKey: finikParsed.ok && !finikParsed.skip ? finikParsed.finikApiKey : null,
        finikAccountId:
          finikParsed.ok && !finikParsed.skip ? finikParsed.finikAccountId : null,
        businessType,
        telegramId,
        ownerUsername,
        botUsername,
        addressLine: addressParsed.value.addressLine,
        city: addressParsed.value.city,
        latitude: addressParsed.value.latitude,
        longitude: addressParsed.value.longitude,
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
