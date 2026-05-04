import type { NextFunction, Request, Response } from "express";
import {
  telegramUserIdStringFromInitData,
  telegramWebAppValidationBotToken,
  validateTelegramInitData,
} from "../server/telegramWebAppInitData.js";

const HEADER = "x-telegram-init-data";

function headerInitData(req: Request): string {
  const raw = req.headers[HEADER];
  const s =
    typeof raw === "string"
      ? raw.trim()
      : Array.isArray(raw) && typeof raw[0] === "string"
        ? raw[0].trim()
        : "";
  return s;
}

/**
 * Авторизация Mini App: подпись `initData` от Telegram, user id только из `user.id`.
 * 401 — нет заголовка; 403 — битая подпись; 500 — нет BOT_TOKEN / BOT_TOKENS на сервере.
 */
export function requireTelegramAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const initData = headerInitData(req);
  if (initData === "") {
    res.status(401).json({ error: "Нужен заголовок x-telegram-init-data (WebApp initData)" });
    return;
  }

  const botToken = telegramWebAppValidationBotToken();
  if (botToken === "") {
    res.status(500).json({ error: "Сервер: не задан токен бота для проверки Web App" });
    return;
  }

  if (!validateTelegramInitData(initData, botToken)) {
    console.warn("[telegram-auth] invalid WebApp signature", req.method, req.path ?? req.url);
    res.status(403).json({ error: "Недействительные данные авторизации Telegram" });
    return;
  }

  const telegramId = telegramUserIdStringFromInitData(initData);
  if (telegramId == null) {
    res.status(403).json({ error: "В initData нет user.id" });
    return;
  }

  req.platformTelegramId = telegramId;
  next();
}
