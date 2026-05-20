import { RegistrationStatus } from "@prisma/client";
import { prisma } from "./db.js";
import {
  isValidBotTokenShape,
} from "../bot/saasRegistrationValidation.js";
import { hashBotTokenSha256Hex } from "./businessBotToken.js";

/** Сообщения согласованы с Mini App / Telegram (без утечки токена в ответ). */
export const MSG_INVALID_BOT_TOKEN =
  "❌ Неверный botToken. Проверьте токен из @BotFather";

export const MSG_BOT_ALREADY_REGISTERED =
  "❌ Этот бот уже зарегистрирован";

export async function verifyTelegramGetMeOk(tokenTrimmed: string): Promise<boolean> {
  const me = await fetchTelegramBotGetMe(tokenTrimmed);
  return me.ok;
}

export async function fetchTelegramBotGetMe(tokenTrimmed: string): Promise<{
  ok: boolean;
  username: string | null;
}> {
  const meRes = await fetch(
    `https://api.telegram.org/bot${encodeURIComponent(tokenTrimmed)}/getMe`,
  );
  const meJson = (await meRes.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: { id?: number; username?: string };
  };
  const ok = meRes.ok === true && meJson.ok === true && meJson.result != null;
  const username =
    typeof meJson.result?.username === "string"
      ? meJson.result.username.trim().replace(/^@/, "") || null
      : null;
  return { ok, username };
}

export async function botTokenBlockedForNewRegistration(
  tokenTrimmed: string,
): Promise<boolean> {
  const trimmed = tokenTrimmed.trim();
  const hash = hashBotTokenSha256Hex(trimmed);
  const inBusiness =
    hash !== ""
      ? await prisma.business.findUnique({
          where: { botTokenHash: hash },
          select: { id: true },
        })
      : null;
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
