/**
 * Проверка подписи Telegram WebApp `initData` (Mini App).
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
import crypto from "node:crypto";

/**
 * Все кандидаты на проверку подписи Mini App из env.
 * Подпись initData зависит от бота, с которого открыли Web App — нужно перебирать все известные токены.
 */
export function envCandidateBotTokensForWebAppInit(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (t: string | undefined | null) => {
    const s = (t ?? "").trim();
    if (s.length === 0 || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  push(process.env.PLATFORM_WEBAPP_BOT_TOKEN);
  push(process.env.BOT_TOKEN);
  const fromMulti = process.env.BOT_TOKENS?.split(/[,;\s]+/) ?? [];
  for (const raw of fromMulti) {
    push(raw.trim());
  }
  return out;
}

/** Первый непустой (для сообщений об ошибке / обратная совместимость). */
export function telegramWebAppValidationBotToken(): string {
  const list = envCandidateBotTokensForWebAppInit();
  return list[0] ?? "";
}

/** Проверка initData любым из переданных токенов (порядок сохраняется). */
export function validateTelegramInitDataWithTokenList(
  initData: string,
  tokens: readonly string[],
): boolean {
  return tokens.some((t) => validateTelegramInitData(initData, t));
}

/**
 * `start_param` из initData (`t.me/Bot?startapp=…` или параметр в Web App).
 * По нему можно загрузить Business.botToken для проверки подписи SaaS-бота, не перечисленного в BOT_TOKENS.
 */
export function parseBusinessIdFromWebAppStartParam(initData: string): number | null {
  const raw = initData.trim();
  if (raw === "") return null;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return null;
  }
  const sp = params.get("start_param")?.trim() ?? "";
  if (sp === "") return null;

  const mShop = /^shop_(\d+)$/i.exec(sp);
  if (mShop) {
    const n = Number(mShop[1]);
    if (Number.isSafeInteger(n) && n > 0) return n;
  }
  if (/^\d+$/.test(sp)) {
    const n = Number(sp);
    if (Number.isSafeInteger(n) && n > 0) return n;
  }
  return null;
}

export function parseStoreSlugFromWebAppStartParam(initData: string): string | null {
  const raw = initData.trim();
  if (raw === "") return null;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return null;
  }
  const sp = params.get("start_param")?.trim() ?? "";
  if (sp === "") return null;

  const parsed = (() => {
    const prefixed = /^(?:slug|store|s|shop)[_:-](.+)$/i.exec(sp);
    if (prefixed) return prefixed[1] ?? "";
    return sp;
  })()
    .trim()
    .toLowerCase();

  if (parsed === "" || parsed.includes("/")) return null;
  if (parsed.length < 2 || parsed.length > 80) return null;
  if (/^\d+$/.test(parsed) || /^shop[_-]?\d+$/i.test(parsed)) return null;
  return parsed;
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
    if (key === "hash") continue;
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

export type TelegramWebAppUser = {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
};

/** Из уже доверенной строки initData — профиль user (без проверки подписи). */
export function parseTelegramWebAppUserFromInitData(
  initData: string,
): TelegramWebAppUser | null {
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
    const u = JSON.parse(userJson) as {
      id?: unknown;
      username?: unknown;
      first_name?: unknown;
      last_name?: unknown;
      photo_url?: unknown;
    };
    const id = u.id;
    if (typeof id !== "number" || !Number.isFinite(id) || id <= 0) return null;
    const n = Math.trunc(id);
    if (!Number.isSafeInteger(n)) return null;
    const username =
      typeof u.username === "string" && u.username.trim() !== ""
        ? u.username.trim().replace(/^@+/, "").toLowerCase()
        : null;
    const firstName =
      typeof u.first_name === "string" && u.first_name.trim() !== ""
        ? u.first_name.trim()
        : null;
    const lastName =
      typeof u.last_name === "string" && u.last_name.trim() !== ""
        ? u.last_name.trim()
        : null;
    const photoUrl =
      typeof u.photo_url === "string" && u.photo_url.trim() !== ""
        ? u.photo_url.trim()
        : null;
    return {
      id: String(n),
      username,
      firstName,
      lastName,
      photoUrl,
    };
  } catch {
    return null;
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
