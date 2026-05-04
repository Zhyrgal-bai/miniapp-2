/**
 * Проверка подписи Telegram WebApp `initData` (Mini App).
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
import crypto from "node:crypto";

function platformWebAppBotTokenFromEnv(): string {
  const explicit = process.env.PLATFORM_WEBAPP_BOT_TOKEN?.trim();
  if (explicit) return explicit;
  const fromMulti = process.env.BOT_TOKENS?.split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (fromMulti && fromMulti.length > 0) return fromMulti[0]!;
  const one = process.env.BOT_TOKEN?.trim();
  return one ?? "";
}

/** Токен бота, с которого открыт Mini App (первый из BOT_TOKENS или BOT_TOKEN / PLATFORM_WEBAPP_BOT_TOKEN). */
export function telegramWebAppValidationBotToken(): string {
  return platformWebAppBotTokenFromEnv();
}

/**
 * Стандарт Telegram: секретный ключ = HMAC-SHA256(key="WebAppData", msg=botToken).
 */
function secretKeyForWebApp(botToken: string): Buffer {
  return crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
}

function buildDataCheckString(params: URLSearchParams): string {
  const pairs: Array<[string, string]> = [];
  for (const key of [...new Set([...params.keys()])]) {
    if (key === "hash" || key === "signature") continue;
    const v = params.get(key);
    if (v == null) continue;
    pairs.push([key, v]);
  }
  pairs.sort(([a], [b]) => a.localeCompare(b));
  return pairs.map(([k, v]) => `${k}=${v}`).join("\n");
}

/**
 * Полная проверка подписи initData строки как в документации Telegram Mini App.
 * @returns true если hash верен (и присутствует).
 */
export function validateTelegramInitData(initData: string, botToken: string): boolean {
  const raw = initData.trim();
  if (raw === "" || botToken.trim() === "") return false;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return false;
  }

  const receivedHash = params.get("hash")?.trim() ?? "";
  if (!/^[0-9a-f]{64}$/i.test(receivedHash)) return false;

  const dataCheckString = buildDataCheckString(params);
  const sk = secretKeyForWebApp(botToken);
  const calculated = crypto
    .createHmac("sha256", sk)
    .update(dataCheckString)
    .digest("hex");

  try {
    const a = Buffer.from(receivedHash, "hex");
    const b = Buffer.from(calculated, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Из уже доверенной строки initData — id пользователя (без проверки подписи). */
export function telegramUserIdStringFromInitData(initData: string): string | null {
  const raw = initData.trim();
  if (raw === "") return null;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return null;
  }
  const userJson = params.get("user");
  if (userJson == null || userJson.trim() === "") return null;
  try {
    const u = JSON.parse(userJson) as { id?: unknown };
    const id = u.id;
    if (typeof id === "number" && Number.isFinite(id) && id > 0) {
      const n = Math.trunc(id);
      if (!Number.isSafeInteger(n)) return null;
      return String(n);
    }
    return null;
  } catch {
    return null;
  }
}
