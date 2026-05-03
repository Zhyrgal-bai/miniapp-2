import { RegistrationStatus } from "@prisma/client";
import { prisma } from "./db.js";
import {
  isValidBotTokenShape,
} from "../bot/saasRegistrationValidation.js";

/** Сообщения согласованы с Mini App / Telegram (без утечки токена в ответ). */
export const MSG_INVALID_BOT_TOKEN =
  "❌ Неверный botToken. Проверьте токен из @BotFather";

export const MSG_BOT_ALREADY_REGISTERED =
  "❌ Этот бот уже зарегистрирован";

export async function verifyTelegramGetMeOk(tokenTrimmed: string): Promise<boolean> {
  const meRes = await fetch(
    `https://api.telegram.org/bot${encodeURIComponent(tokenTrimmed)}/getMe`,
  );
  const meJson = (await meRes.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: { id?: number };
  };
  return meRes.ok === true && meJson.ok === true && meJson.result != null;
}

export async function botTokenBlockedForNewRegistration(
  tokenTrimmed: string,
): Promise<boolean> {
  const trimmed = tokenTrimmed.trim();
  const inBusiness = await prisma.business.findUnique({
    where: { botToken: trimmed },
    select: { id: true },
  });
  if (inBusiness) return true;
  const pendingReq = await prisma.registrationRequest.findFirst({
    where: {
      botToken: trimmed,
      status: RegistrationStatus.PENDING,
    },
    select: { id: true },
  });
  return pendingReq != null;
}

export type PrecheckBotRegistration =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Все проверки до записи заявки: формат, Telegram getMe, занятость Business / PENDING заявка.
 */
export async function precheckBotTokenBeforeRegistrationPersist(
  tokenRaw: string,
): Promise<PrecheckBotRegistration> {
  const tokenTrimmed = tokenRaw.replace(/\s/g, "").trim();
  if (!isValidBotTokenShape(tokenTrimmed)) {
    return { ok: false, error: MSG_INVALID_BOT_TOKEN };
  }
  const telegramOk = await verifyTelegramGetMeOk(tokenTrimmed);
  if (!telegramOk) {
    return { ok: false, error: MSG_INVALID_BOT_TOKEN };
  }
  if (await botTokenBlockedForNewRegistration(tokenTrimmed)) {
    return { ok: false, error: MSG_BOT_ALREADY_REGISTERED };
  }
  return { ok: true };
}
