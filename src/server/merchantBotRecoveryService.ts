import { activeBots, initDynamicStoreBot } from "../bot/dynamicBots.js";
import { plainBotTokenFromStored } from "./businessBotToken.js";
import { isEncryptedTokenFormat } from "./botTokenCrypto.js";
import { prisma } from "./db.js";
import { publicApiOrigin } from "./finikMerchant.js";
import {
  classifyWebhookOkError,
  fetchTelegramWebhookInfo,
} from "./platformTelegramWebhook.js";

export type MerchantBotStatusCode =
  | "connected"
  | "webhook_error"
  | "token_error"
  | "not_configured";

export type MerchantBotRecoveryPayload = {
  status: MerchantBotStatusCode;
  label: string;
  detail: string | null;
  webhookUrl: string | null;
  botUsername: string | null;
  isActive: boolean;
  isBlocked: boolean;
  botInMemory: boolean;
  publicApiConfigured: boolean;
};

const STATUS_LABEL: Record<MerchantBotStatusCode, string> = {
  connected: "Подключён",
  webhook_error: "Ошибка webhook",
  token_error: "Ошибка токена",
  not_configured: "Не настроен",
};

type TokenResolve =
  | { kind: "ok"; token: string }
  | { kind: "missing" }
  | { kind: "error"; message: string };

function resolveStoredBotToken(stored: string | null): TokenResolve {
  const raw = String(stored ?? "").trim();
  if (raw === "") {
    return { kind: "missing" };
  }
  if (isEncryptedTokenFormat(raw)) {
    try {
      const token = plainBotTokenFromStored(raw).trim();
      if (token === "" || isEncryptedTokenFormat(token)) {
        return {
          kind: "error",
          message:
            "Токен бота не расшифрован на сервере. Обратитесь в поддержку платформы.",
        };
      }
      return { kind: "ok", token };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        kind: "error",
        message: `Не удалось прочитать токен бота: ${msg}`,
      };
    }
  }
  const token = raw.replace(/\s/g, "").trim();
  if (token === "") return { kind: "missing" };
  return { kind: "ok", token };
}

async function probeTelegramGetMe(
  token: string,
): Promise<{ ok: true; username: string | null } | { ok: false; message: string }> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`,
    );
    const j = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
      result?: { username?: string };
    };
    if (!res.ok || !j.ok) {
      const desc =
        typeof j.description === "string" && j.description.trim() !== ""
          ? j.description.trim()
          : "Telegram отклонил токен (getMe)";
      return { ok: false, message: desc };
    }
    const username =
      typeof j.result?.username === "string" && j.result.username.trim() !== ""
        ? j.result.username.trim()
        : null;
    return { ok: true, username };
  } catch {
    return { ok: false, message: "Не удалось связаться с Telegram API" };
  }
}

export function classifyMerchantBotRecovery(input: {
  token: TokenResolve;
  getMeOk: boolean;
  getMeError: string | null;
  webhookStatus: "OK" | "ERROR" | "skipped";
  webhookLastError: string | null;
  publicApiConfigured: boolean;
}): Pick<MerchantBotRecoveryPayload, "status" | "label" | "detail"> {
  if (input.token.kind === "missing") {
    return {
      status: "not_configured",
      label: STATUS_LABEL.not_configured,
      detail: "Укажите токен бота в настройках магазина (BotFather).",
    };
  }
  if (input.token.kind === "error" || !input.getMeOk) {
    return {
      status: "token_error",
      label: STATUS_LABEL.token_error,
      detail:
        input.token.kind === "error"
          ? input.token.message
          : input.getMeError ?? "Неверный токен бота",
    };
  }
  if (!input.publicApiConfigured) {
    return {
      status: "webhook_error",
      label: STATUS_LABEL.webhook_error,
      detail:
        "На сервере платформы не задан публичный API_URL — webhook нельзя установить. Сообщите поддержке платформы.",
    };
  }
  if (input.webhookStatus === "ERROR") {
    const tail =
      input.webhookLastError != null && input.webhookLastError.trim() !== ""
        ? input.webhookLastError.trim()
        : "Webhook не настроен или Telegram сообщает об ошибке";
    return {
      status: "webhook_error",
      label: STATUS_LABEL.webhook_error,
      detail: tail,
    };
  }
  return {
    status: "connected",
    label: STATUS_LABEL.connected,
    detail: null,
  };
}

/** Диагностика бота магазина (без побочных эффектов). */
export async function buildMerchantBotRecoveryStatus(
  businessId: number,
): Promise<MerchantBotRecoveryPayload | null> {
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      botToken: true,
      isActive: true,
      isBlocked: true,
    },
  });
  if (b == null) return null;

  const publicApiConfigured = publicApiOrigin() !== "";
  const token = resolveStoredBotToken(b.botToken);
  let getMeOk = false;
  let getMeError: string | null = null;
  let botUsername: string | null = null;

  if (token.kind === "ok") {
    const me = await probeTelegramGetMe(token.token);
    if (me.ok) {
      getMeOk = true;
      botUsername = me.username;
    } else {
      getMeError = me.message;
    }
  }

  let webhookStatus: "OK" | "ERROR" | "skipped" = "skipped";
  let webhookUrl: string | null = null;
  let webhookLastError: string | null = null;

  if (token.kind === "ok" && getMeOk && publicApiConfigured) {
    const info = await fetchTelegramWebhookInfo(token.token);
    webhookUrl = info.webhookUrl;
    webhookLastError = info.lastErrorMessage;
    webhookStatus = classifyWebhookOkError(info);
  }

  const classified = classifyMerchantBotRecovery({
    token,
    getMeOk,
    getMeError,
    webhookStatus,
    webhookLastError,
    publicApiConfigured,
  });

  return {
    ...classified,
    webhookUrl,
    botUsername,
    isActive: b.isActive,
    isBlocked: b.isBlocked,
    botInMemory: activeBots.has(businessId),
    publicApiConfigured,
  };
}

/** Переподключить webhook и поднять бота в памяти (только свой businessId). */
export async function reconnectMerchantStoreBot(
  businessId: number,
): Promise<
  | { ok: true; status: MerchantBotRecoveryPayload }
  | { ok: false; statusCode: number; error: string; status?: MerchantBotRecoveryPayload }
> {
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, botToken: true, isBlocked: true },
  });
  if (b == null) {
    return { ok: false, statusCode: 404, error: "Магазин не найден" };
  }
  if (b.isBlocked) {
    return {
      ok: false,
      statusCode: 403,
      error: "Магазин заблокирован оператором платформы",
    };
  }

  const token = resolveStoredBotToken(b.botToken);
  if (token.kind === "missing") {
    const status = await buildMerchantBotRecoveryStatus(businessId);
    return {
      ok: false,
      statusCode: 400,
      error: "Сначала укажите токен бота в настройках",
      ...(status != null ? { status } : {}),
    };
  }
  if (token.kind === "error") {
    const status = await buildMerchantBotRecoveryStatus(businessId);
    return {
      ok: false,
      statusCode: 400,
      error: token.message,
      ...(status != null ? { status } : {}),
    };
  }

  if (publicApiOrigin() === "") {
    const status = await buildMerchantBotRecoveryStatus(businessId);
    return {
      ok: false,
      statusCode: 503,
      error: "Публичный URL API не настроен на сервере платформы",
      ...(status != null ? { status } : {}),
    };
  }

  try {
    await initDynamicStoreBot({ businessId, botToken: token.token });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = await buildMerchantBotRecoveryStatus(businessId);
    return {
      ok: false,
      statusCode: 502,
      error: msg,
      ...(status != null ? { status } : {}),
    };
  }

  const status = await buildMerchantBotRecoveryStatus(businessId);
  if (status == null) {
    return { ok: false, statusCode: 404, error: "Магазин не найден" };
  }
  return { ok: true, status };
}
