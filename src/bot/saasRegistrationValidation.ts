import { validateKgPhone as kgPhone } from "../server/orderInputSanitize.js";

/**
 * Формат токена от @BotFather: `<bot_id>:<secret>`.
 * secret — alphanumeric + `_` `-` (RFC без логирования значения наружу).
 */
const BOT_TOKEN_PATTERN = /^\d{6,22}:[A-Za-z0-9_-]{30,}$/;

export function validateKgPhone(raw: string): boolean {
  return kgPhone(String(raw ?? "").trim());
}

export function isValidBotTokenShape(raw: string): boolean {
  const t = String(raw ?? "").replace(/\s+/g, "").trim();
  if (t.length < 40 || t.length > 120) return false;
  return BOT_TOKEN_PATTERN.test(t);
}

/** Название магазина: непустое после нормализации, разумная длина */
export function isValidStoreName(raw: string): boolean {
  const n = raw.replace(/\s+/g, " ").trim();
  return n.length >= 2 && n.length <= 160;
}
