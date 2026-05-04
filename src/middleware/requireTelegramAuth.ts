import type { NextFunction, Request, Response } from "express";
import { plainBotTokenFromStored } from "../server/businessBotToken.js";
import { prisma } from "../server/db.js";
import {
  envCandidateBotTokensForWebAppInit,
  parseBusinessIdFromWebAppStartParam,
  telegramUserIdStringFromInitData,
  validateTelegramInitData,
} from "../server/telegramWebAppInitData.js";

const HEADER = "x-telegram-init-data";

function shouldLogTelegramAuthDebug(): boolean {
  return (
    process.env.TELEGRAM_INIT_DEBUG === "1" ||
    process.env.NODE_ENV !== "production"
  );
}

/** По умолчанию включён; отключить: WEBAPP_VALIDATE_INITDATA_SCAN_STORE_BOTS=0 */
function shouldScanStoreBotsForInitData(): boolean {
  const v = process.env.WEBAPP_VALIDATE_INITDATA_SCAN_STORE_BOTS?.trim();
  if (v === "0" || v === "false" || v === "off") return false;
  return true;
}

/** Пустой initData без проверки: только локальная разработка или SKIP_TELEGRAM_WEBAPP_AUTH=1 + DEV_TELEGRAM_USER_ID */
function emptyInitDataBypassAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.SKIP_TELEGRAM_WEBAPP_AUTH === "1"
  );
}

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

function logCheckingToken(plainToken: string): void {
  if (!shouldLogTelegramAuthDebug()) return;
  console.log("Checking token:", plainToken.slice(0, 10));
}

/**
 * true — ответ уже отправлен (next или ошибка acceptInitData).
 */
function tryValidateInitDataWithToken(
  initData: string,
  plainToken: string,
  req: Request,
  res: Response,
  next: NextFunction,
): boolean {
  if (plainToken.trim() === "") return false;
  logCheckingToken(plainToken);
  if (!validateTelegramInitData(initData, plainToken)) return false;
  logHashOk(req);
  acceptInitData(req, res, next, initData);
  return true;
}

/**
 * Mini App: multi-bot initData.
 * Порядок: start_param → Business.botToken → BOT_TOKENS/env → скан магазинов в БД (по умолчанию вкл.).
 */
export async function requireTelegramAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const initData = headerInitData(req);

    if (shouldLogTelegramAuthDebug()) {
      console.log(
        initData === ""
          ? "[telegram-auth] initData: (empty)"
          : `[telegram-auth] initData length=${initData.length}`,
      );
    }

    if (initData === "") {
      if (emptyInitDataBypassAllowed()) {
        const tid = process.env.DEV_TELEGRAM_USER_ID?.trim();
        if (tid !== undefined && /^\d+$/.test(tid)) {
          console.warn(
            "[telegram-auth] DEV: без initData используется DEV_TELEGRAM_USER_ID (не использовать в проде без крайней необходимости)",
          );
          req.platformTelegramId = tid;
          next();
          return;
        }
      }
      res.status(401).json({
        error:
          "Нужен заголовок x-telegram-init-data — откройте Mini App из Telegram (или задайте DEV_TELEGRAM_USER_ID в режиме разработки)",
      });
      return;
    }

    const envToks = envCandidateBotTokensForWebAppInit();
    const businessIdHint = parseBusinessIdFromWebAppStartParam(initData);
    const scanOn = shouldScanStoreBotsForInitData();

    const canTrySomething =
      businessIdHint != null || envToks.length > 0 || scanOn;
    if (!canTrySomething) {
      res.status(500).json({
        error:
          "Сервер: задайте BOT_TOKEN / BOT_TOKENS / PLATFORM_WEBAPP_BOT_TOKEN, либо start_param с id магазина, либо включите скан БД (WEBAPP_VALIDATE_INITDATA_SCAN_STORE_BOTS не 0)",
      });
      return;
    }

    if (businessIdHint != null) {
      const row = await prisma.business.findUnique({
        where: { id: businessIdHint },
        select: { botToken: true },
      });
      const plain = row != null ? plainBotTokenFromStored(row.botToken) : "";
      if (tryValidateInitDataWithToken(initData, plain, req, res, next)) {
        return;
      }
    }

    for (const t of envToks) {
      if (tryValidateInitDataWithToken(initData, t, req, res, next)) {
        return;
      }
    }

    if (scanOn) {
      const rows = await prisma.business.findMany({
        select: { botToken: true },
        orderBy: { id: "desc" },
        take: 1000,
      });
      for (const r of rows) {
        const plain = plainBotTokenFromStored(r.botToken);
        if (tryValidateInitDataWithToken(initData, plain, req, res, next)) {
          return;
        }
      }
    }

    console.warn(
      "[telegram-auth] invalid WebApp signature",
      req.method,
      req.path ?? req.url,
    );
    res.status(403).json({
      error: "Недействительные данные авторизации Telegram",
    });
  } catch (e) {
    next(e);
  }
}

function logHashOk(req: Request): void {
  if (shouldLogTelegramAuthDebug()) {
    console.log(
      "[telegram-auth] initData hash OK",
      req.method,
      req.path ?? req.url,
    );
  }
}

function acceptInitData(
  req: Request,
  res: Response,
  next: NextFunction,
  initData: string,
): void {
  const telegramId = telegramUserIdStringFromInitData(initData);
  if (telegramId == null) {
    res.status(403).json({ error: "В initData нет user.id" });
    return;
  }
  req.platformTelegramId = telegramId;
  next();
}
