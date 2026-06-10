import type { NextFunction, Request, Response } from "express";
import { plainBotTokenFromStored } from "../server/businessBotToken.js";
import { prisma } from "../server/db.js";
import {
  logAuthHeaderMissing,
  logAuthHeaderPresent,
  logBusinessNotFound,
  logInitDataInvalid,
  logPrivilegedRouteReject,
  logStartParamMissing,
  logTokenMismatch,
} from "../server/structuredLog.js";
import { tenantBusinessIdFromRequest } from "../server/tenantHintFromRequest.js";
import {
  envCandidateBotTokensForWebAppInit,
  parseBusinessIdFromWebAppStartParam,
  parseStoreSlugFromWebAppStartParam,
  telegramUserIdStringFromInitData,
  validateTelegramInitData,
} from "../server/telegramWebAppInitData.js";
import {
  logInitDataPolicyReject,
  validateInitDataPolicy,
} from "./telegramInitDataPolicy.js";

const HEADER = "x-telegram-init-data";

type TokenSource =
  | "start_param"
  | "request_tenant"
  | "slug"
  | "env"
  | "db_scan";

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

function authPath(req: Request): string {
  return req.path ?? req.url ?? "";
}

function authMethod(req: Request): string {
  return req.method.toUpperCase();
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

function startParamPresent(initData: string): boolean {
  try {
    const sp = new URLSearchParams(initData).get("start_param")?.trim() ?? "";
    return sp !== "";
  } catch {
    return false;
  }
}

/** Не роняем весь запрос, если один из магазинов в БД с битым ciphertext/ключом. */
function safePlainBotTokenFromStored(raw: string | null | undefined): string {
  try {
    return plainBotTokenFromStored(raw);
  } catch (e) {
    console.warn(
      "[telegram-auth] пропуск токена магазина (дешифрование/формат):",
      e instanceof Error ? e.message : String(e),
    );
    return "";
  }
}

function acceptInitData(
  req: Request,
  res: Response,
  next: NextFunction,
  initData: string,
  source: TokenSource,
): void {
  const telegramId = telegramUserIdStringFromInitData(initData);
  if (telegramId == null) {
    logPrivilegedRouteReject({
      path: authPath(req),
      method: authMethod(req),
      reason: "init_data_missing_user_id",
      status: 403,
    });
    res.status(403).json({ error: "В initData нет user.id" });
    return;
  }
  if (shouldLogTelegramAuthDebug()) {
    console.log(
      "[telegram-auth] initData hash OK",
      authMethod(req),
      authPath(req),
      `source=${source}`,
    );
  }
  req.platformTelegramId = telegramId;
  next();
}

function tryToken(
  initData: string,
  plainToken: string,
  req: Request,
  res: Response,
  next: NextFunction,
  source: TokenSource,
  triedTokens: Set<string>,
): boolean {
  const token = plainToken.trim();
  if (token === "" || triedTokens.has(token)) return false;
  triedTokens.add(token);
  if (!validateTelegramInitData(initData, token)) return false;
  const policy = validateInitDataPolicy(initData);
  if (!policy.ok) {
    logInitDataPolicyReject(authPath(req), authMethod(req), policy.reason);
    logPrivilegedRouteReject({
      path: authPath(req),
      method: authMethod(req),
      reason: policy.reason,
      status: 403,
    });
    res.status(403).json({
      error: "Сессия Telegram устарела. Закройте и откройте Mini App снова.",
    });
    return true;
  }
  acceptInitData(req, res, next, initData, source);
  return true;
}

async function tryBusinessToken(
  initData: string,
  businessId: number,
  source: TokenSource,
  req: Request,
  res: Response,
  next: NextFunction,
  triedTokens: Set<string>,
): Promise<boolean> {
  const path = authPath(req);
  const method = authMethod(req);

  const row = await prisma.business.findUnique({
    where: { id: businessId },
    select: { botToken: true },
  });
  if (row == null) {
    logBusinessNotFound({
      path,
      method,
      businessId,
      source,
      tokenPresent: false,
    });
    return false;
  }

  const plain = safePlainBotTokenFromStored(row.botToken);
  if (plain.trim() === "") {
    logBusinessNotFound({
      path,
      method,
      businessId,
      source,
      tokenPresent: false,
    });
    return false;
  }

  if (
    tryToken(initData, plain, req, res, next, source, triedTokens)
  ) {
    return true;
  }

  logTokenMismatch({
    path,
    method,
    source,
    businessId,
    tokenPresent: true,
  });
  return false;
}

/**
 * Mini App: multi-bot initData.
 * Порядок: start_param → x-business-id/shop/body → slug → env → скан БД.
 */
export async function requireTelegramAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const initData = headerInitData(req);
    const path = authPath(req);
    const method = authMethod(req);

    if (shouldLogTelegramAuthDebug()) {
      console.log(
        initData === ""
          ? "[telegram-auth] initData: (empty)"
          : `[telegram-auth] initData length=${initData.length}`,
      );
    }

    if (initData === "") {
      logAuthHeaderMissing({ path, method });
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
      logPrivilegedRouteReject({
        path,
        method,
        reason: "missing_init_data_header",
        status: 401,
      });
      res.status(401).json({
        error:
          "Нужен заголовок x-telegram-init-data — откройте Mini App из Telegram (или задайте DEV_TELEGRAM_USER_ID в режиме разработки)",
      });
      return;
    }

    logAuthHeaderPresent({ path, method, length: initData.length });

    const businessIdHint = parseBusinessIdFromWebAppStartParam(initData);
    const slugHint = parseStoreSlugFromWebAppStartParam(initData);
    const requestTenantId = tenantBusinessIdFromRequest(req);
    const hadStartParam = startParamPresent(initData);
    const envToks = envCandidateBotTokensForWebAppInit();
    const scanOn = shouldScanStoreBotsForInitData();
    const triedTokens = new Set<string>();

    if (!hadStartParam) {
      logStartParamMissing({
        path,
        method,
        requestTenantBusinessId: requestTenantId,
      });
    }

    const canTrySomething =
      businessIdHint != null ||
      requestTenantId != null ||
      slugHint != null ||
      envToks.length > 0 ||
      scanOn;
    if (!canTrySomething) {
      res.status(500).json({
        error:
          "Сервер: задайте BOT_TOKEN / BOT_TOKENS / PLATFORM_WEBAPP_BOT_TOKEN, либо start_param с id магазина, либо включите скан БД (WEBAPP_VALIDATE_INITDATA_SCAN_STORE_BOTS не 0)",
      });
      return;
    }

    if (businessIdHint != null) {
      if (
        await tryBusinessToken(
          initData,
          businessIdHint,
          "start_param",
          req,
          res,
          next,
          triedTokens,
        )
      ) {
        return;
      }
    }

    if (requestTenantId != null && requestTenantId !== businessIdHint) {
      if (
        await tryBusinessToken(
          initData,
          requestTenantId,
          "request_tenant",
          req,
          res,
          next,
          triedTokens,
        )
      ) {
        return;
      }
    }

    if (slugHint != null) {
      const row = await prisma.business.findFirst({
        where: { slug: { equals: slugHint, mode: "insensitive" } } as any,
        select: { id: true, botToken: true },
      });
      if (row == null) {
        logBusinessNotFound({
          path,
          method,
          businessId: -1,
          source: "slug",
          tokenPresent: false,
        });
      } else {
        const plain = safePlainBotTokenFromStored(row.botToken);
        if (plain.trim() === "") {
          logBusinessNotFound({
            path,
            method,
            businessId: row.id,
            source: "slug",
            tokenPresent: false,
          });
        } else if (
          tryToken(initData, plain, req, res, next, "slug", triedTokens)
        ) {
          return;
        } else {
          logTokenMismatch({
            path,
            method,
            source: "slug",
            businessId: row.id,
            tokenPresent: true,
          });
        }
      }
    }

    for (const t of envToks) {
      if (tryToken(initData, t, req, res, next, "env", triedTokens)) {
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
        const plain = safePlainBotTokenFromStored(r.botToken);
        if (tryToken(initData, plain, req, res, next, "db_scan", triedTokens)) {
          return;
        }
      }
    }

    if (shouldLogTelegramAuthDebug()) {
      let hasHexHash = false;
      try {
        const h =
          new URLSearchParams(initData).get("hash")?.trim() ?? "";
        hasHexHash = /^[0-9a-f]{64}$/i.test(h);
      } catch {
        /* ignore */
      }
      console.warn(
        "[telegram-auth] все проверки подписи не прошли: hasHash=%s envTokens=%s startParamBizId=%s requestTenant=%s startParamSlug=%s scan=%s tried=%s",
        hasHexHash,
        envToks.length,
        businessIdHint ?? "none",
        requestTenantId ?? "none",
        slugHint ?? "none",
        scanOn,
        triedTokens.size,
      );
    }

    logInitDataInvalid({
      path,
      method,
      tokensTried: triedTokens.size,
      hadStartParam,
      hadTenantHint: requestTenantId != null,
      startParamBusinessId: businessIdHint,
      requestTenantBusinessId: requestTenantId,
    });

    console.warn(
      "[telegram-auth] invalid WebApp signature",
      req.method,
      req.path ?? req.url,
    );
    logPrivilegedRouteReject({
      path,
      method,
      reason: "invalid_init_data_signature",
      status: 403,
    });
    res.status(403).json({
      error: "Недействительные данные авторизации Telegram",
    });
  } catch (e) {
    next(e);
  }
}
