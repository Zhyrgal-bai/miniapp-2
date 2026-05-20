import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { MembershipRole, Prisma } from "@prisma/client";
import cors from "cors";
import {
  isCloudinaryConfigured,
  uploadImageToCloudinary,
  uploadReceiptToCloudinary,
} from "./cloudinary.js";
import { adminUserIdFromRequest } from "./adminAuth.js";
import { listMerchantOwnedBusinesses } from "./merchantDashboard.js";
import { listPlatformOwnerBusinesses } from "./platformMyBusinesses.js";
import {
  platformCheckWebhookForMerchant,
  platformToggleBotForMerchant,
} from "./platformMerchantBotControl.js";
import {
  approveMerchantBotTokenChangeById,
  listPendingMerchantChangeRequests,
  rejectMerchantBotTokenChangeById,
} from "./platformMerchantChangeService.js";
import {
  getPlatformStoreSettingsForMerchant,
  updatePlatformFinikForMerchant,
  updatePlatformStoreSettingsForMerchant,
  type PlatformStoreSettingsUpdateBody,
} from "./platformMerchantStoreSettings.js";
import {
  formatZodApiError,
  platformCheckWebhookBodySchema,
  platformDeleteMyBusinessBodySchema,
  platformRegisterRequestShape,
  platformSubscriptionPaymentBodySchema,
  platformToggleBotBodySchema,
} from "./platformRouteBodySchemas.js";
import { validateAndPersistPlatformRegistration } from "./platformRegisterRequest.js";
import { getMerchantRegistrationStatus } from "./registrationStatusService.js";
import {
  validateOrderOptionsForCheckout,
  validateProductAttributes,
} from "./templateValidation.js";
import {
  approveRegistrationRequestById,
  extendBusinessSubscriptionAdmin,
  isPlatformAdminTelegramId,
  isPlatformOperatorTelegramId,
  listBusinessesForPlatformAdmin,
  listPendingRegistrationRequestsForAdmin,
  purgeBusinessCompletelyForPlatformAdmin,
  rejectRegistrationRequestById,
} from "./platformAdminService.js";
import {
  OPERATOR_SESSION_HEADER,
  hasRecentOperatorReauth,
  markOperatorSessionReauth,
  revokeOperatorSession,
  unlockOperatorSession,
  validateOperatorSession,
  verifyOperatorPassword,
} from "./platformOperatorAuth.js";
import { templateForBusinessType } from "../templates/index.js";
import {
  StorefrontConfigSchema,
  StorefrontStyleCatalogPatchSchema,
  applyStorefrontStyleCatalogPatch,
  defaultStorefrontConfig,
  resolveStorefrontConfig,
  type ResolvedStorefrontPayload,
} from "../storefront/schema.js";
import { validateUx } from "../ux/validators.js";
import { validateImageFile, uploadTenantImage } from "../media/upload.js";
import { extractCloudinaryPublicIds, safeDeleteCloudinaryAsset } from "../media/delete.js";
import { invalidateStorefrontCache } from "./storefrontCache.js";
import { buildMerchantAnalytics } from "./merchantAnalyticsService.js";
import { buildMerchantInsights } from "./merchantInsightsService.js";
import { buildMerchantGrowth } from "./merchantGrowthService.js";
import { getCoPurchaseRecommendations } from "./recommendationsService.js";
import { maybeEmitSmartAlerts } from "./smartAlertsService.js";
import { assertEnvironmentOrExit } from "./envValidation.js";
import {
  funnelSummarySince,
  ingestPlatformFunnelEvents,
} from "./platformFunnelService.js";
import {
  createProductFeedback,
  listProductFeedback,
} from "./productFeedbackService.js";
import { maybeEmitRetentionNudges } from "./merchantRetentionService.js";
import { buildMerchantGrowthDashboard } from "./merchantGrowthDashboardService.js";
import {
  createMerchantNotification,
  ingestStorefrontEvents,
  listMerchantNotifications,
  markMerchantNotificationsRead,
} from "./merchantNotificationsService.js";
import {
  normalizePublicStoreSlug,
  sendStorefrontPublicPayload,
} from "./storefrontPublicPayload.js";
import {
  adminBlockBusiness,
  adminDeactivateBusiness,
  adminEnableNonBlockedBusiness,
  adminUnblockBusiness,
} from "./saasBillingService.js";
import {
  isAllowedOrderStatusTransition,
  isValidOrderStatus,
  type OrderStatus,
} from "./orderStatus.js";
import {
  adminMiniAppNotifyKeyboard,
  bot,
  bots,
  getBotForOwner,
  getNotifyTargetChatId,
  initDynamicStoreBot,
} from "../bot/bot.js";
/** Навешивает `attachBotHandlers` на клиентские боты без цикла dynamicBots ↔ bot */
import "../bot/registerDynamicBrain.js";
import { launchClientBot } from "../bot/launchClientBot.js";
import { registerDynamicBotsGracefulShutdownOnce } from "../bot/botManager.js";
import {
  encryptedBotTokenRow,
  hashBotTokenSha256Hex,
  plainBotTokenFromStored,
} from "./businessBotToken.js";
import { connectDatabase, logPrismaError, prisma } from "./db.js";
import {
  MERCHANT_PERM,
  effectiveMerchantPermissions,
  merchantHasPermission,
  sanitizeMerchantPermissionInput,
  type MerchantPermissionId,
} from "./merchantPermissions.js";
import {
  clearPaymentFieldByRowId,
  listPaymentDetailsFromDb,
  upsertPaymentSettings,
} from "./paymentRepo.js";
import {
  consumePromoDb,
  createPromoDb,
  deletePromoByCodeDb,
  listPromosFromDb,
  tryApplyPromoDb,
} from "./promoRepo.js";
import { notifyAfterOrderStatusChangeFromApi } from "./orderTelegramNotify.js";
import {
  allocateHumanOrderNumber,
  formatNewOrderTelegramMessage,
  orderDisplayLabel,
} from "./orderNumber.js";
import { buildMerchantAdminOrdersWebAppUrl } from "./miniAppUrls.js";
import {
  createFinikMerchantSession,
  mountFinikWebhookRoutes,
  mountFinikSettingsRoutes,
  publicApiOrigin,
} from "./finikMerchant.js";
import {
  mountSubscriptionFinikPaymentRoutes,
  createSubscriptionFinikPaymentSession,
} from "./subscriptionFinikPayments.js";
import { relayDynamicStoreWebhook as relayDynamicTenantStoreWebhook } from "./storeTelegramWebhookRelay.js";
import {
  isHexWebhookSlug,
  legacyNumericWebhookPathEnabled,
  telegramSetWebhookOnApi,
  telegramWebhookGate,
} from "./telegramWebhookSecurity.js";
import { startSubscriptionMaintenanceScheduler } from "./subscriptionMaintenance.js";
import { cleanInput, validateKgPhone } from "./orderInputSanitize.js";
import {
  applyThemePatchAndValidate,
  publicBusinessThemeResponse,
} from "./storeTheme.js";
import { resolveStoreTheme } from "../shared/storeTheme.js";
import {
  businessMiddleware,
} from "../middleware/business.middleware.js";
import { apiSafeErrorHandler } from "../middleware/apiErrorHandler.js";
import { apiLimiter, strictLimiter } from "../middleware/apiRateLimits.js";
import { jsonBodyLimits } from "../middleware/jsonBodyLimits.js";
import { requireNonEmptyJsonBody } from "../middleware/requireNonEmptyJsonBody.js";
import { requireTelegramAuth } from "../middleware/requireTelegramAuth.js";
import { isStorefrontClosedForCustomers } from "./subscriptionAccess.js";
import { attachSupportRoutes } from "./supportRoutes.js";

const __serverDir = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST = path.resolve(__serverDir, "../../frontend/dist");
const SPA_INDEX = path.join(FRONTEND_DIST, "index.html");
const SPA_AVAILABLE = fs.existsSync(SPA_INDEX);

function sendSpaIndexHtml(res: Response, next: NextFunction) {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
  });
  res.sendFile(SPA_INDEX, (err) => {
    if (err) next(err);
  });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

console.log(
  "BOTS:",
  process.env.BOT_TOKENS
    ? `${String(process.env.BOT_TOKENS).split(/[,;]+/).filter(Boolean).length} tokens (BOT_TOKENS)`
    : process.env.BOT_TOKEN
      ? "1 token (BOT_TOKEN)"
      : "missing"
);
console.log("CHAT ID env:", process.env.CHAT_ID ?? "(empty)");

type OrderTotalBody = {
  total?: unknown;
  subtotal?: unknown;
  promo?: unknown;
  promoCode?: unknown;
};

function promoApplyErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (msg === "NOT_FOUND") return "Промокод не найден";
  if (msg === "EXHAUSTED") return "Промокод исчерпан";
  if (msg === "BAD_TOTAL") return "Неверная сумма";
  if (msg === "EMPTY") return "Укажите промокод";
  return "Промокод недействителен";
}

/** Сверка total/subtotal с промокодом (без списания использования). */
async function computeOrderTotalFromBody(
  body: OrderTotalBody,
  businessId: number
): Promise<
  { ok: true; orderTotal: number; promoRaw: string } | { ok: false; error: string }
> {
  const promoRaw = String(body.promo ?? body.promoCode ?? "").trim();
  const subtotalVal = Number(body.subtotal ?? body.total);
  const bodyTotal = Number(body.total);

  if (!Number.isFinite(bodyTotal)) {
    return { ok: false, error: "Неверная сумма заказа" };
  }

  if (promoRaw) {
    if (!Number.isFinite(subtotalVal) || subtotalVal < 0) {
      return { ok: false, error: "Нужны subtotal и total для промокода" };
    }
    try {
      const applied = await tryApplyPromoDb(
        prisma,
        businessId,
        promoRaw,
        subtotalVal
      );
      if (Math.abs(bodyTotal - applied.newTotal) > 0.01) {
        return { ok: false, error: "Сумма не совпадает с промокодом" };
      }
      return { ok: true, orderTotal: applied.newTotal, promoRaw };
    } catch (e) {
      return { ok: false, error: promoApplyErrorMessage(e) };
    }
  }

  const orderTotal = Math.round(bodyTotal);
  if (Number.isFinite(subtotalVal)) {
    if (Math.abs(orderTotal - Math.round(subtotalVal)) > 0.01) {
      return { ok: false, error: "Неверная сумма" };
    }
  }
  return { ok: true, orderTotal, promoRaw: "" };
}

const app = express();
/** Корректный client IP за прокси (Render / nginx) для rate limit вебхука */
app.set("trust proxy", 1);

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-telegram-id",
      "x-telegram-init-data",
      "x-business-id",
      "x-operator-session",
    ],
  })
);
app.use(jsonBodyLimits);

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.get("/ready", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: true, ts: new Date().toISOString() });
  } catch (e) {
    console.error("GET /ready:", e);
    res.status(503).json({ ok: false, db: false });
  }
});

/** Диагностика: телеграм-вебхуки без тела или с 403/404 в gate — видно ли запрос вообще. */
app.use((req: Request, _res: Response, next: () => void) => {
  const p =
    typeof req.path === "string" && req.path !== ""
      ? req.path
      : new URL(req.url, "http://localhost").pathname;
  if (
    p.startsWith("/webhook") ||
    p.startsWith("/telegram-webhook")
  ) {
    console.log("INCOMING:", req.method, req.originalUrl ?? req.url);
  }
  next();
});
app.use("/api/", apiLimiter);
app.use("/api/platform", requireTelegramAuth);
mountFinikWebhookRoutes(app);
mountFinikSettingsRoutes(app);
mountSubscriptionFinikPaymentRoutes(app);

/**
 * Диагностика platform admin доступа (без токенов/PII).
 * `isPlatformAdmin` = Telegram user id входит в ADMIN_IDS / PLATFORM_ADMIN_TELEGRAM_ID на сервере.
 */
app.get("/api/platform/admin/whoami", async (req: Request, res: Response) => {
  try {
    const telegramId = platformTelegramIdFromWebApp(req);
    if (!telegramId) {
      res.status(500).json({ error: "Внутренняя ошибка авторизации Mini App" });
      return;
    }
    res.json({
      telegramId,
      isPlatformAdmin: isPlatformAdminTelegramId(telegramId),
    });
  } catch (e) {
    console.error("GET /api/platform/admin/whoami:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

/** Публичная витрина: тема магазина без Telegram (до tenant middleware). */
app.get("/api/business/:businessId", async (req: Request, res: Response) => {
  try {
    const businessId = Number(req.params.businessId);
    if (!Number.isSafeInteger(businessId) || businessId <= 0) {
      res.status(400).json({ error: "Invalid business id" });
      return;
    }
    const row = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        themeConfig: true,
        templateId: true,
        isActive: true,
        isBlocked: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
        trialEndsAt: true,
      },
    });
    if (row == null) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    // Публичная витрина/тема: доступность определяется флагами витрины.
    // Подписка/триал — отдельная бизнес-логика (платформа/лимиты), не "hard-disable" theme fetch.
    if (row.isBlocked || !row.isActive) {
      res.status(403).json({ error: "Store unavailable" });
      return;
    }
    const settings = await prisma.settings.findUnique({
      where: { businessId },
      select: { logoUrl: true },
    });
    const themed = publicBusinessThemeResponse(
      row.themeConfig,
      settings?.logoUrl,
      row.templateId,
    );
    res.json({
      id: row.id,
      name: row.name,
      themeConfig: themed.themeConfig,
      templateId: themed.templateId,
    });
  } catch (e) {
    console.error("GET /api/business/:id:", e);
    res.status(500).json({ error: "Server error" });
  }
});

/** Платформа Mini App: user id только из подписанного initData (`requireTelegramAuth`). */
function platformTelegramIdFromWebApp(req: Request): string | null {
  const id = req.platformTelegramId;
  return typeof id === "string" && /^\d+$/.test(id) ? id : null;
}

function operatorForbidden(res: Response, code = "operator_forbidden"): void {
  res.status(403).json({ error: "Forbidden", code });
}

function operatorSessionTokenFromReq(req: Request): string | null {
  const raw = req.headers[OPERATOR_SESSION_HEADER];
  const token =
    typeof raw === "string"
      ? raw.trim()
      : Array.isArray(raw) && typeof raw[0] === "string"
        ? raw[0].trim()
        : "";
  return token !== "" ? token : null;
}

async function requireOperatorIdentity(
  req: Request,
  res: Response,
): Promise<string | null> {
  const telegramId = platformTelegramIdFromWebApp(req);
  if (!telegramId) {
    res.status(500).json({ error: "Внутренняя ошибка авторизации Mini App" });
    return null;
  }
  if (!isPlatformOperatorTelegramId(telegramId)) {
    operatorForbidden(res);
    return null;
  }
  return telegramId;
}

async function requireOperatorUnlock(
  req: Request,
  res: Response,
): Promise<{ telegramId: string; token: string } | null> {
  const telegramId = await requireOperatorIdentity(req, res);
  if (!telegramId) return null;
  const token = operatorSessionTokenFromReq(req);
  if (!token) {
    operatorForbidden(res, "operator_unlock_required");
    return null;
  }
  const valid = await validateOperatorSession({
    operatorTelegramId: telegramId,
    token,
  });
  if (!valid.ok) {
    operatorForbidden(res, "operator_unlock_required");
    return null;
  }
  return { telegramId, token };
}

async function requireOperatorRecentReauth(
  req: Request,
  res: Response,
): Promise<{ telegramId: string; token: string } | null> {
  const unlocked = await requireOperatorUnlock(req, res);
  if (!unlocked) return null;
  const ok = await hasRecentOperatorReauth({
    operatorTelegramId: unlocked.telegramId,
    token: unlocked.token,
  });
  if (!ok) {
    operatorForbidden(res, "reauth_required");
    return null;
  }
  return unlocked;
}

app.get("/api/platform/operator/capabilities", async (req: Request, res: Response) => {
  try {
    const telegramId = platformTelegramIdFromWebApp(req);
    if (!telegramId) {
      res.status(500).json({ error: "Внутренняя ошибка авторизации Mini App" });
      return;
    }
    const isOperatorIdentity = isPlatformOperatorTelegramId(telegramId);
    res.json({
      isOperatorIdentity,
      canShowOperatorEntry: isOperatorIdentity,
    });
  } catch (e) {
    console.error("GET /api/platform/operator/capabilities:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post(
  "/api/platform/operator/unlock",
  strictLimiter,
  requireNonEmptyJsonBody,
  async (req: Request, res: Response) => {
    try {
      const telegramId = await requireOperatorIdentity(req, res);
      if (!telegramId) return;
      const password =
        typeof (req.body as { password?: unknown }).password === "string"
          ? (req.body as { password: string }).password.trim()
          : "";
      if (password === "") {
        res.status(400).json({ error: "Нужен пароль", code: "password_required" });
        return;
      }
      const out = await unlockOperatorSession({
        operatorTelegramId: telegramId,
        password,
        userAgent:
          typeof req.headers["user-agent"] === "string"
            ? req.headers["user-agent"]
            : null,
        ip: typeof req.ip === "string" ? req.ip : null,
      });
      if (!out.ok) {
        res.status(out.status).json({ error: out.message, code: out.code });
        return;
      }
      res.json({ token: out.token, expiresAt: out.expiresAt });
    } catch (e) {
      console.error("POST /api/platform/operator/unlock:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },
);

app.post(
  "/api/platform/operator/lock",
  strictLimiter,
  async (req: Request, res: Response) => {
    try {
      const telegramId = await requireOperatorIdentity(req, res);
      if (!telegramId) return;
      const token = operatorSessionTokenFromReq(req);
      if (!token) {
        res.json({ ok: true });
        return;
      }
      await revokeOperatorSession({
        operatorTelegramId: telegramId,
        token,
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("POST /api/platform/operator/lock:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },
);

app.get("/api/platform/operator/session", async (req: Request, res: Response) => {
  try {
    const telegramId = await requireOperatorIdentity(req, res);
    if (!telegramId) return;
    const token = operatorSessionTokenFromReq(req);
    if (!token) {
      operatorForbidden(res, "operator_unlock_required");
      return;
    }
    const valid = await validateOperatorSession({
      operatorTelegramId: telegramId,
      token,
    });
    if (!valid.ok) {
      operatorForbidden(res, "operator_unlock_required");
      return;
    }
    res.json({ unlocked: true, expiresAt: valid.expiresAt });
  } catch (e) {
    console.error("GET /api/platform/operator/session:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post(
  "/api/platform/operator/reauth",
  strictLimiter,
  requireNonEmptyJsonBody,
  async (req: Request, res: Response) => {
    try {
      const unlocked = await requireOperatorUnlock(req, res);
      if (!unlocked) return;
      const password =
        typeof (req.body as { password?: unknown }).password === "string"
          ? (req.body as { password: string }).password.trim()
          : "";
      if (password === "") {
        res.status(400).json({ error: "Нужен пароль", code: "password_required" });
        return;
      }
      const ok = await verifyOperatorPassword(password);
      if (!ok) {
        res
          .status(401)
          .json({ error: "Неверный пароль", code: "operator_unlock_failed" });
        return;
      }
      await markOperatorSessionReauth({
        operatorTelegramId: unlocked.telegramId,
        token: unlocked.token,
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("POST /api/platform/operator/reauth:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },
);

app.get("/api/platform/my-businesses", async (req: Request, res: Response) => {
  try {
    const telegramId = platformTelegramIdFromWebApp(req);
    if (!telegramId) {
      res.status(500).json({
        error: "Внутренняя ошибка авторизации Mini App",
      });
      return;
    }

    const rawQ = req.query.telegramId ?? req.query.userId;
    const queryTid =
      typeof rawQ === "string"
        ? rawQ.trim()
        : Array.isArray(rawQ) && typeof rawQ[0] === "string"
          ? rawQ[0].trim()
          : "";
    if (/^\d+$/.test(queryTid) && queryTid !== telegramId) {
      res.status(403).json({
        error: "Несовпадение telegramId в запросе с данными авторизации Telegram",
      });
      return;
    }

    const rows = await listPlatformOwnerBusinesses(telegramId);
    res.json(rows);
  } catch (e) {
    console.error("GET /api/platform/my-businesses:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post(
  "/api/platform/check-webhook",
  strictLimiter,
  requireNonEmptyJsonBody,
  async (req: Request, res: Response) => {
  try {
    const telegramId = platformTelegramIdFromWebApp(req);
    if (!telegramId) {
      res.status(500).json({
        error: "Внутренняя ошибка авторизации Mini App",
      });
      return;
    }
    const parsedBw = platformCheckWebhookBodySchema.safeParse(req.body);
    if (!parsedBw.success) {
      res.status(400).json({ error: formatZodApiError(parsedBw.error) });
      return;
    }
    const { businessId } = parsedBw.data;

    const r = await platformCheckWebhookForMerchant({
      telegramId,
      businessId,
    });
    if (!r.ok) {
      res.status(r.status).json({ error: r.error });
      return;
    }
    res.json({
      status: r.status,
      lastErrorMessage: r.lastErrorMessage,
    });
  } catch (e) {
    console.error("POST /api/platform/check-webhook:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post(
  "/api/platform/toggle-bot",
  strictLimiter,
  requireNonEmptyJsonBody,
  async (req: Request, res: Response) => {
  try {
    const telegramId = platformTelegramIdFromWebApp(req);
    if (!telegramId) {
      res.status(500).json({
        error: "Внутренняя ошибка авторизации Mini App",
      });
      return;
    }
    const parsedTb = platformToggleBotBodySchema.safeParse(req.body);
    if (!parsedTb.success) {
      res.status(400).json({ error: formatZodApiError(parsedTb.error) });
      return;
    }
    const { businessId, action } = parsedTb.data;

    const r = await platformToggleBotForMerchant({
      telegramId,
      businessId,
      action,
    });
    if (!r.ok) {
      res.status(r.status).json({ error: r.error });
      return;
    }
    res.json({ ok: true, isActive: r.isActive });
  } catch (e) {
    console.error("POST /api/platform/toggle-bot:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post(
  "/api/platform/delete-my-business",
  strictLimiter,
  requireNonEmptyJsonBody,
  async (req: Request, res: Response) => {
    try {
      const unlocked = await requireOperatorRecentReauth(req, res);
      if (!unlocked) return;
      const parsed = platformDeleteMyBusinessBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: formatZodApiError(parsed.error) });
        return;
      }
      const { businessId } = parsed.data;
      const out = await purgeBusinessCompletelyForPlatformAdmin(
        businessId,
        unlocked.telegramId,
      );
      if (!out.ok) {
        res.status(out.statusCode).json({ error: out.message });
        return;
      }
      res.json({ ok: true });
    } catch (e) {
      console.error("POST /api/platform/delete-my-business:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },
);

app.post(
  "/api/platform/subscription-payment/create",
  strictLimiter,
  requireNonEmptyJsonBody,
  async (req: Request, res: Response) => {
    try {
      const telegramId = platformTelegramIdFromWebApp(req);
      if (!telegramId) {
        res.status(500).json({
          error: "Внутренняя ошибка авторизации Mini App",
        });
        return;
      }
      const parsed = platformSubscriptionPaymentBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: formatZodApiError(parsed.error) });
        return;
      }
      const { businessId, plan } = parsed.data;
      const out = await createSubscriptionFinikPaymentSession({
        telegramId,
        businessId,
        plan,
      });
      if (!out.ok) {
        res.status(out.statusCode).json({ error: out.error });
        return;
      }
      if ("finikConfigured" in out && out.finikConfigured === false) {
        res.status(200).json({
          finikConfigured: false,
          useManualPaymentRequest: true,
          message: out.message,
        });
        return;
      }
      if ("paymentUrl" in out) {
        res.json({
          paymentUrl: out.paymentUrl,
          subscriptionPaymentId: out.subscriptionPaymentId,
          planDays: out.planDays,
          amountSom: out.amountSom,
        });
      }
    } catch (e) {
      console.error("POST /api/platform/subscription-payment/create:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },
);

app.get("/api/platform/store-settings", async (req: Request, res: Response) => {
  try {
    const telegramId = platformTelegramIdFromWebApp(req);
    if (!telegramId) {
      res.status(500).json({
        error: "Внутренняя ошибка авторизации Mini App",
      });
      return;
    }
    const bid = Number((req.query as { businessId?: string }).businessId);
    if (!Number.isInteger(bid) || bid <= 0) {
      res.status(400).json({ error: "Нужен query businessId" });
      return;
    }
    const out = await getPlatformStoreSettingsForMerchant({
      telegramId,
      businessId: bid,
    });
    if (!out.ok) {
      res.status(out.statusCode).json({ error: out.error });
      return;
    }
    res.json(out.settings);
  } catch (e) {
    console.error("GET /api/platform/store-settings:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/platform/store-settings", async (req: Request, res: Response) => {
  try {
    const telegramId = platformTelegramIdFromWebApp(req);
    if (!telegramId) {
      res.status(500).json({
        error: "Внутренняя ошибка авторизации Mini App",
      });
      return;
    }
    const reqBody = req.body as { businessId?: unknown };
    const rawBid = reqBody.businessId;
    const businessId =
      typeof rawBid === "number" && Number.isInteger(rawBid)
        ? rawBid
        : typeof rawBid === "string"
          ? Number(rawBid.trim())
          : NaN;
    if (!Number.isInteger(businessId) || businessId <= 0) {
      res.status(400).json({ error: "Нужен корректный businessId" });
      return;
    }
    const raw = req.body as Record<string, unknown>;
    const settingsBody: PlatformStoreSettingsUpdateBody = {
      storeName: raw.storeName,
      finikApiKey: raw.finikApiKey,
      newBotToken: raw.newBotToken,
      merchantConfig: raw.merchantConfig,
    };
    const out = await updatePlatformStoreSettingsForMerchant({
      telegramId,
      businessId,
      body: settingsBody,
    });
    if (!out.ok) {
      res.status(out.statusCode).json({ error: out.error });
      return;
    }
    res.json(out);
  } catch (e) {
    console.error("POST /api/platform/store-settings:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/platform/update-finik", async (req: Request, res: Response) => {
  try {
    const telegramId = platformTelegramIdFromWebApp(req);
    if (!telegramId) {
      res.status(500).json({
        error: "Внутренняя ошибка авторизации Mini App",
      });
      return;
    }
    const reqBody = req.body as { businessId?: unknown; finikApiKey?: unknown };
    const rawBid = reqBody.businessId;
    const businessId =
      typeof rawBid === "number" && Number.isInteger(rawBid)
        ? rawBid
        : typeof rawBid === "string"
          ? Number(rawBid.trim())
          : NaN;
    if (!Number.isInteger(businessId) || businessId <= 0) {
      res.status(400).json({ error: "Нужен корректный businessId" });
      return;
    }
    const out = await updatePlatformFinikForMerchant({
      telegramId,
      businessId,
      finikApiKey: reqBody.finikApiKey,
    });
    if (!out.ok) {
      res.status(out.statusCode).json({ error: out.error });
      return;
    }
    res.json({ ok: true, finikConfigured: out.finikConfigured });
  } catch (e) {
    console.error("POST /api/platform/update-finik:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.get("/api/platform/registration-status", async (req: Request, res: Response) => {
  try {
    const telegramId = platformTelegramIdFromWebApp(req);
    if (!telegramId) {
      res.status(500).json({ error: "Внутренняя ошибка авторизации Mini App" });
      return;
    }
    const payload = await getMerchantRegistrationStatus(telegramId);
    res.json(payload);
  } catch (e) {
    console.error("GET /api/platform/registration-status:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post(
  "/api/platform/register-request",
  strictLimiter,
  requireNonEmptyJsonBody,
  async (req: Request, res: Response) => {
  try {
    const authTid = platformTelegramIdFromWebApp(req);
    if (!authTid) {
      res.status(500).json({ error: "Внутренняя ошибка авторизации Mini App" });
      return;
    }
    const shaped = platformRegisterRequestShape.safeParse(req.body);
    if (!shaped.success) {
      res.status(400).json({ error: formatZodApiError(shaped.error) });
      return;
    }
    const bodyTidRaw = shaped.data.telegramId;
    const bodyTid =
      typeof bodyTidRaw === "number" && Number.isFinite(bodyTidRaw)
        ? String(Math.trunc(bodyTidRaw))
        : typeof bodyTidRaw === "string"
          ? bodyTidRaw.replace(/\s/g, "").trim()
          : "";

    if (bodyTid !== "" && bodyTid !== authTid) {
      res.status(403).json({
        error: "Несовпадение telegramId в теле запроса с подписанными данными Telegram",
      });
      return;
    }

    const result = await validateAndPersistPlatformRegistration({
      storeName: shaped.data.storeName,
      botToken: shaped.data.botToken,
      phone: shaped.data.phone,
      finikApiKey: shaped.data.finikApiKey,
      businessType: shaped.data.businessType,
      ownerUsername: shaped.data.ownerUsername,
      telegramId: authTid,
    });
    if (!result.ok) {
      res.status(result.statusCode).json({ error: result.error });
      return;
    }
    res.status(201).json({ ok: true, id: result.id });
  } catch (e) {
    console.error("POST /api/platform/register-request:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.get("/api/merchant/schemas", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.catalogEdit);
    if (!merchant) return;
    const b = await prisma.business.findUnique({
      where: { id: merchant.businessId },
    });
    const bt = (b as any)?.businessType;
    if (typeof bt !== "string" || bt.trim() === "") {
      return res.status(400).json({ error: "Магазин без businessType" });
    }
    const tpl = templateForBusinessType(bt as any);
    res.json({
      businessType: bt,
      templateVersion: tpl.templateVersion ?? 1,
      productSchema: tpl.productSchema ?? {},
      merchantSettingsSchema: tpl.merchantSettingsSchema ?? {},
      orderOptionsSchema: tpl.orderOptionsSchema ?? {},
    });
  } catch (e) {
    console.error("GET /api/merchant/schemas:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.get("/api/storefront/by-slug/:slug", async (req: Request, res: Response) => {
  try {
    const slug = normalizePublicStoreSlug(String(req.params.slug ?? ""));
    if (!slug) {
      res.status(400).json({ error: "Invalid slug" });
      return;
    }
    const b = await prisma.business.findFirst({
      where: {
        slug: { equals: slug, mode: "insensitive" },
      } as any,
      select: { id: true, isActive: true, isBlocked: true } as any,
    });
    if (!b) {
      res.status(404).json({ error: "Store not found" });
      return;
    }
    if (!(b as any).isActive || (b as any).isBlocked) {
      res.status(403).json({ error: "Store unavailable" });
      return;
    }
    await sendStorefrontPublicPayload(res, (b as any).id);
  } catch (e) {
    console.error("GET /api/storefront/by-slug/:slug:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/storefront/:businessId", async (req: Request, res: Response) => {
  try {
    const businessId = Number(req.params.businessId);
    await sendStorefrontPublicPayload(res, businessId);
  } catch (e) {
    console.error("GET /api/storefront/:businessId:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/merchant/storefront-builder", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.designEdit);
    if (!merchant) return;

    const b = await prisma.business.findUnique({
      where: { id: merchant.businessId },
      select: {
        id: true,
        businessType: true,
        templateId: true,
        themeConfig: true,
        featureFlags: true,
        storefrontDraftConfig: true,
        storefrontPublishedConfig: true,
        storefrontPublishedAt: true,
        storefrontConfig: true,
        storefrontConfigVersion: true,
      } as any,
    });
    if (!b) return res.status(404).json({ error: "Business not found" });

    const parseCfg = (raw: unknown) => {
      const out = StorefrontConfigSchema.safeParse(raw ?? {});
      return out.success ? out.data : defaultStorefrontConfig();
    };

    const sf = await prisma.storefront.findFirst({
      where: { businessId: merchant.businessId },
      orderBy: { id: "asc" },
      select: {
        id: true,
        draftConfig: true,
        publishedConfig: true,
        publishedAt: true,
      } as any,
    });

    const published =
      sf && (sf as any).publishedConfig && JSON.stringify((sf as any).publishedConfig) !== "{}"
        ? parseCfg((sf as any).publishedConfig)
        : (b as any).storefrontPublishedConfig &&
            JSON.stringify((b as any).storefrontPublishedConfig) !== "{}"
          ? parseCfg((b as any).storefrontPublishedConfig)
          : parseCfg((b as any).storefrontConfig);

    const draft =
      sf && (sf as any).draftConfig && JSON.stringify((sf as any).draftConfig) !== "{}"
        ? parseCfg((sf as any).draftConfig)
        : (b as any).storefrontDraftConfig &&
            JSON.stringify((b as any).storefrontDraftConfig) !== "{}"
          ? parseCfg((b as any).storefrontDraftConfig)
          : published;

    const preview = resolveStorefrontConfig({
      businessId: merchant.businessId,
      businessType: String((b as any).businessType ?? ""),
      templateId: (b as any).templateId ?? null,
      storefrontConfigVersion: Number((b as any).storefrontConfigVersion ?? 1),
      rawStorefrontConfig: draft,
      rawThemeConfig: (b as any).themeConfig ?? {},
      rawFeatureFlags: (b as any).featureFlags ?? {},
    });

    res.json({
      businessId: merchant.businessId,
      storefrontId: sf ? (sf as any).id : null,
      draft,
      published,
      publishedAt: (sf as any)?.publishedAt ?? (b as any).storefrontPublishedAt ?? null,
      themeConfig: (b as any).themeConfig ?? {},
      templateId: (b as any).templateId ?? null,
      featureFlags: (b as any).featureFlags ?? {},
      preview,
    });
  } catch (e) {
    console.error("GET /api/merchant/storefront-builder:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/merchant/storefront-builder/draft", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.designEdit);
    if (!merchant) return;

    const body = req.body as { draftConfig?: unknown; themePatch?: unknown } | undefined;
    const parsed = StorefrontConfigSchema.safeParse(body?.draftConfig ?? body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid draftConfig" });
    }

    // themePatch will be validated in Stage 4 (theme v2); for now accept object merge.
    const themePatch =
      body?.themePatch != null && typeof body.themePatch === "object" && !Array.isArray(body.themePatch)
        ? (body.themePatch as Record<string, unknown>)
        : null;

    const b = await prisma.business.findUnique({
      where: { id: merchant.businessId },
      select: {
        templateId: true,
        themeConfig: true,
      } as any,
    });

    const nextThemeStored = themePatch ?? ((b as any)?.themeConfig ?? {});
    const resolvedTheme = resolveStoreTheme((b as any)?.templateId ?? null, nextThemeStored);
    const ux = validateUx({ draft: parsed.data as any, theme: resolvedTheme });

    const sf = await prisma.storefront.findFirst({
      where: { businessId: merchant.businessId },
      orderBy: { id: "asc" },
      select: { id: true, draftConfig: true } as any,
    });

    // Safe delete sync: remove assets that disappeared from draft (hero/promo/etc).
    // Never throws fatal; cross-tenant safety enforced by publicId prefix.
    try {
      const prevDraft = sf ? (sf as any).draftConfig : null;
      const prevIds = new Set(extractCloudinaryPublicIds(prevDraft));
      const nextIds = new Set(extractCloudinaryPublicIds(parsed.data));
      for (const pid of prevIds) {
        if (!nextIds.has(pid)) {
          await safeDeleteCloudinaryAsset({
            businessId: merchant.businessId,
            publicId: pid,
          });
        }
      }
    } catch (e) {
      console.error("draft media delete sync:", e);
    }

    if (sf) {
      await prisma.storefront.update({
        where: { id: (sf as any).id },
        data: { draftConfig: parsed.data as any } as any,
      });
    } else {
      // Fallback: legacy Business draft storage
      const data: any = {
        storefrontDraftConfig: parsed.data as any,
        storefrontDraftUpdatedAt: new Date(),
      };
      await prisma.business.update({
        where: { id: merchant.businessId },
        data,
      });
    }
    if (themePatch) {
      await prisma.business.update({
        where: { id: merchant.businessId },
        data: { themeConfig: themePatch as any } as any,
      });
    }
    invalidateStorefrontCache(merchant.businessId);
    res.json({ ok: true, draftVersion: parsed.data.version, ux });
  } catch (e) {
    console.error("PUT /api/merchant/storefront-builder/draft:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/merchant/storefront-builder/publish", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.designEdit);
    if (!merchant) return;

    const b = await prisma.business.findUnique({
      where: { id: merchant.businessId },
      select: {
        storefrontDraftConfig: true,
        templateId: true,
        themeConfig: true,
      } as any,
    });
    if (!b) return res.status(404).json({ error: "Business not found" });

    const sf = await prisma.storefront.findFirst({
      where: { businessId: merchant.businessId },
      orderBy: { id: "asc" },
      select: { id: true, draftConfig: true } as any,
    });
    const rawDraft = sf ? (sf as any).draftConfig : (b as any).storefrontDraftConfig;
    const draft = StorefrontConfigSchema.safeParse(rawDraft ?? {});
    const draftSafe = draft.success ? draft.data : defaultStorefrontConfig();

    const resolvedTheme = resolveStoreTheme((b as any).templateId ?? null, (b as any).themeConfig ?? {});
    const ux = validateUx({ draft: draftSafe as any, theme: resolvedTheme });
    if (ux.errors.length > 0) {
      return res.status(400).json({
        error: "UX validation failed",
        ux,
      });
    }

    if (sf) {
      await prisma.storefront.update({
        where: { id: (sf as any).id },
        data: {
          publishedConfig: draftSafe as any,
          publishedAt: new Date(),
        } as any,
      });
    } else {
      await prisma.business.update({
        where: { id: merchant.businessId },
        data: {
          storefrontPublishedConfig: draftSafe as any,
          storefrontPublishedAt: new Date(),
        } as any,
      });
    }
    invalidateStorefrontCache(merchant.businessId);
    res.json({ ok: true, publishedAt: new Date().toISOString(), ux });
  } catch (e) {
    console.error("POST /api/merchant/storefront-builder/publish:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/merchant/storefront-builder/reset", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.designEdit);
    if (!merchant) return;
    const def = defaultStorefrontConfig();
    const sf = await prisma.storefront.findFirst({
      where: { businessId: merchant.businessId },
      orderBy: { id: "asc" },
      select: { id: true } as any,
    });
    if (sf) {
      await prisma.storefront.update({
        where: { id: (sf as any).id },
        data: { draftConfig: def as any } as any,
      });
    } else {
      await prisma.business.update({
        where: { id: merchant.businessId },
        data: {
          storefrontDraftConfig: def as any,
          storefrontDraftUpdatedAt: new Date(),
        } as any,
      });
    }
    invalidateStorefrontCache(merchant.businessId);
    res.json({ ok: true, draft: def });
  } catch (e) {
    console.error("POST /api/merchant/storefront-builder/reset:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/merchant/reusable-blocks", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.designEdit);
    if (!merchant) return;
    const typeRaw = req.query.type;
    const type =
      typeof typeRaw === "string" && typeRaw.trim() !== ""
        ? typeRaw.trim()
        : undefined;
    const rows = await prisma.storefrontReusableBlock.findMany({
      where: {
        businessId: merchant.businessId,
        ...(type ? { type } : {}),
      } as any,
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    res.json({ blocks: rows });
  } catch (e) {
    console.error("GET /api/merchant/reusable-blocks:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/merchant/reusable-blocks", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.designEdit);
    if (!merchant) return;
    const body = req.body as { name?: unknown; type?: unknown; config?: unknown } | undefined;
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
    const type = typeof body?.type === "string" ? body.type.trim().slice(0, 40) : "";
    if (!name || !type) {
      return res.status(400).json({ error: "Invalid name/type" });
    }
    // Validate config through StorefrontConfigSchema by wrapping in one section.
    const cfg = body?.config ?? {};
    const wrapped = StorefrontConfigSchema.safeParse({
      version: 1,
      sections: [
        {
          id: "block",
          type,
          enabled: true,
          order: 10,
          config: cfg,
        },
      ],
    });
    if (!wrapped.success) {
      return res.status(400).json({ error: "Invalid section config" });
    }

    const created = await prisma.storefrontReusableBlock.create({
      data: {
        businessId: merchant.businessId,
        type,
        name,
        config: cfg as any,
      } as any,
    });
    res.json({ ok: true, block: created });
  } catch (e) {
    console.error("POST /api/merchant/reusable-blocks:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.delete(
  "/api/merchant/reusable-blocks/:id",
  async (req: Request, res: Response) => {
    try {
      const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.designEdit);
      if (!merchant) return;
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid id" });
      }
      const row = await prisma.storefrontReusableBlock.findUnique({ where: { id } });
      if (!row || (row as any).businessId !== merchant.businessId) {
        return res.status(404).json({ error: "Not found" });
      }

      // Safe delete sync: delete Cloudinary assets referenced by this block config.
      try {
        const ids = extractCloudinaryPublicIds((row as any).config);
        for (const pid of ids) {
          await safeDeleteCloudinaryAsset({ businessId: merchant.businessId, publicId: pid });
        }
      } catch (e) {
        console.error("reusable block delete sync:", e);
      }

      await prisma.storefrontReusableBlock.delete({ where: { id } });
      res.json({ ok: true });
    } catch (e) {
      console.error("DELETE /api/merchant/reusable-blocks/:id:", e);
      res.status(500).json({ error: "Server error" });
    }
  },
);

app.get("/api/merchant/storefront-config", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.designEdit);
    if (!merchant) return;
    const b = await prisma.business.findUnique({
      where: { id: merchant.businessId },
    });
    if (!b) return res.status(404).json({ error: "Business not found" });
    const raw = (b as any).storefrontConfig ?? {};
    const out = StorefrontConfigSchema.safeParse(raw);
    const rawSafe = out.success ? out.data : { version: 1, sections: [] };
    const preview = resolveStorefrontConfig({
      businessId: b.id,
      businessType: String((b as any).businessType ?? ""),
      templateId: (b as any).templateId ?? null,
      storefrontConfigVersion: Number((b as any).storefrontConfigVersion ?? 1),
      rawStorefrontConfig: rawSafe,
      rawThemeConfig: (b as any).themeConfig ?? {},
      rawFeatureFlags: (b as any).featureFlags ?? {},
    });
    res.json({
      businessId: b.id,
      storefrontConfig: rawSafe,
      storefrontConfigVersion: Number((b as any).storefrontConfigVersion ?? 1),
      preview,
    });
  } catch (e) {
    console.error("GET /api/merchant/storefront-config:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/merchant/storefront-config", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.designEdit);
    if (!merchant) return;
    const parsed = StorefrontConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid storefrontConfig" });
    }
    await prisma.business.update({
      where: { id: merchant.businessId },
      data: {
        storefrontConfig: parsed.data as any,
        storefrontConfigVersion: parsed.data.version,
      } as any,
    });
    invalidateStorefrontCache(merchant.businessId);
    res.json({ ok: true, storefrontConfigVersion: parsed.data.version });
  } catch (e) {
    console.error("PUT /api/merchant/storefront-config:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/merchant/storefront-style-catalog-patch", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.designEdit);
    if (!merchant) return;

    const parsedPatch = StorefrontStyleCatalogPatchSchema.safeParse(req.body);
    if (!parsedPatch.success) {
      res.status(400).json({ error: formatZodApiError(parsedPatch.error) });
      return;
    }

    const bid = merchant.businessId;
    const b = await prisma.business.findUnique({
      where: { id: bid },
      select: {
        storefrontConfig: true,
        storefrontPublishedConfig: true,
      } as any,
    });
    if (!b) {
      res.status(404).json({ error: "Business not found" });
      return;
    }

    const sf = await prisma.storefront.findFirst({
      where: { businessId: bid },
      orderBy: { id: "asc" },
      select: { id: true, publishedConfig: true, draftConfig: true } as any,
    });

    const publishedRaw =
      sf &&
      (sf as any).publishedConfig != null &&
      typeof (sf as any).publishedConfig === "object" &&
      JSON.stringify((sf as any).publishedConfig) !== "{}"
        ? (sf as any).publishedConfig
        : (b as any).storefrontPublishedConfig != null &&
            typeof (b as any).storefrontPublishedConfig === "object" &&
            JSON.stringify((b as any).storefrontPublishedConfig) !== "{}"
          ? (b as any).storefrontPublishedConfig
          : {};
    const legacyRaw =
      (b as any).storefrontConfig != null && typeof (b as any).storefrontConfig === "object"
        ? (b as any).storefrontConfig
        : {};
    const rawConfig =
      publishedRaw && JSON.stringify(publishedRaw) !== "{}" ? publishedRaw : legacyRaw;

    const cfgParsed = StorefrontConfigSchema.safeParse(rawConfig ?? {});
    const cfg = cfgParsed.success ? cfgParsed.data : defaultStorefrontConfig();

    const nextStyle = applyStorefrontStyleCatalogPatch(
      cfg.storefrontStyleConfig ?? {},
      parsedPatch.data,
    );
    const nextCfg = StorefrontConfigSchema.parse({
      ...cfg,
      storefrontStyleConfig: nextStyle,
    });

    const mergeDraftStyleWithPublished = (draftRaw: unknown) => {
      const d = StorefrontConfigSchema.safeParse(draftRaw ?? {});
      const draftBase = d.success ? d.data : defaultStorefrontConfig();
      return StorefrontConfigSchema.parse({
        ...draftBase,
        storefrontStyleConfig: nextCfg.storefrontStyleConfig,
      });
    };

    if (sf) {
      const draftMerged = mergeDraftStyleWithPublished((sf as any).draftConfig);
      await prisma.storefront.update({
        where: { id: (sf as any).id },
        data: {
          publishedConfig: nextCfg as any,
          draftConfig: draftMerged as any,
        } as any,
      });
    } else {
      const pubNonempty =
        (b as any).storefrontPublishedConfig != null &&
        typeof (b as any).storefrontPublishedConfig === "object" &&
        JSON.stringify((b as any).storefrontPublishedConfig) !== "{}";
      if (pubNonempty) {
        await prisma.business.update({
          where: { id: bid },
          data: { storefrontPublishedConfig: nextCfg as any } as any,
        });
      } else {
        await prisma.business.update({
          where: { id: bid },
          data: { storefrontConfig: nextCfg as any } as any,
        });
      }
    }

    invalidateStorefrontCache(bid);
    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/merchant/storefront-style-catalog-patch:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/platform/admin/requests", async (req: Request, res: Response) => {
  try {
    const unlocked = await requireOperatorUnlock(req, res);
    if (!unlocked) return;
    const rawQ = req.query.telegramId ?? req.query.userId;
    const queryTid =
      typeof rawQ === "string"
        ? rawQ.trim()
        : Array.isArray(rawQ) && typeof rawQ[0] === "string"
          ? rawQ[0].trim()
          : "";
    if (/^\d+$/.test(queryTid) && queryTid !== unlocked.telegramId) {
      res.status(403).json({
        error: "Несовпадение telegramId в query с данными авторизации Telegram",
      });
      return;
    }
    const rows = await listPendingRegistrationRequestsForAdmin();
    res.json(rows);
  } catch (e) {
    console.error("GET /api/platform/admin/requests:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.get("/api/platform/admin/funnel/summary", async (req: Request, res: Response) => {
  try {
    const unlocked = await requireOperatorUnlock(req, res);
    if (!unlocked) return;
    const days = Number(req.query.days);
    const rangeDays = days === 7 || days === 30 || days === 90 ? days : 30;
    const since = new Date(Date.now() - rangeDays * 86400000);
    const steps = await funnelSummarySince(since);
    res.json({ rangeDays, since: since.toISOString(), steps });
  } catch (e) {
    console.error("GET /api/platform/admin/funnel/summary:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.get("/api/platform/admin/feedback", async (req: Request, res: Response) => {
  try {
    const unlocked = await requireOperatorUnlock(req, res);
    if (!unlocked) return;
    const statusQ =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const items = await listProductFeedback({
      ...(statusQ ? { status: statusQ } : {}),
      limit: 80,
    });
    res.json({ items });
  } catch (e) {
    console.error("GET /api/platform/admin/feedback:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/platform/admin/approve", async (req: Request, res: Response) => {
  try {
    if (!(await requireOperatorRecentReauth(req, res))) return;
    const requestId = Number((req.body as { requestId?: unknown }).requestId);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      res.status(400).json({ error: "Нужен корректный requestId" });
      return;
    }
    const out = await approveRegistrationRequestById(requestId);
    if (!out.ok) {
      res.status(out.statusCode).json({ error: out.message });
      return;
    }
    res.json({ ok: true, businessId: out.businessId });
  } catch (error: any) {
    console.error("APPROVE ERROR FULL:", error);
    if (error?.stack) console.error(error.stack);
    res.status(500).json({
      error: "approve_failed",
      message: error?.message || "unknown",
    });
  }
});

app.post("/api/platform/admin/reject", async (req: Request, res: Response) => {
  try {
    if (!(await requireOperatorRecentReauth(req, res))) return;
    const requestId = Number((req.body as { requestId?: unknown }).requestId);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      res.status(400).json({ error: "Нужен корректный requestId" });
      return;
    }
    const rejectReasonRaw = (req.body as { rejectReason?: unknown }).rejectReason;
    const rejectReason =
      typeof rejectReasonRaw === "string" ? rejectReasonRaw : undefined;
    const out = await rejectRegistrationRequestById(requestId, rejectReason);
    if (!out.ok) {
      res.status(out.statusCode).json({ error: out.message });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/platform/admin/reject:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/platform/admin/block", async (req: Request, res: Response) => {
  try {
    if (!(await requireOperatorRecentReauth(req, res))) return;
    const businessId = Number(
      (req.body as { businessId?: unknown }).businessId,
    );
    if (!Number.isInteger(businessId) || businessId <= 0) {
      res.status(400).json({ error: "Нужен корректный businessId" });
      return;
    }
    const exists = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    if (!exists) {
      res.status(404).json({ error: "Магазин не найден" });
      return;
    }
    await adminBlockBusiness(businessId);
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/platform/admin/block:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/platform/admin/unblock", async (req: Request, res: Response) => {
  try {
    if (!(await requireOperatorRecentReauth(req, res))) return;
    const businessId = Number(
      (req.body as { businessId?: unknown }).businessId,
    );
    if (!Number.isInteger(businessId) || businessId <= 0) {
      res.status(400).json({ error: "Нужен корректный businessId" });
      return;
    }
    const exists = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    if (!exists) {
      res.status(404).json({ error: "Магазин не найден" });
      return;
    }
    await adminUnblockBusiness(businessId);
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/platform/admin/unblock:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.get("/api/platform/admin/businesses", async (req: Request, res: Response) => {
  try {
    const unlocked = await requireOperatorUnlock(req, res);
    if (!unlocked) return;
    const rawQl = req.query.telegramId ?? req.query.userId;
    const queryTidAdmin =
      typeof rawQl === "string"
        ? rawQl.trim()
        : Array.isArray(rawQl) && typeof rawQl[0] === "string"
          ? rawQl[0].trim()
          : "";
    if (/^\d+$/.test(queryTidAdmin) && queryTidAdmin !== unlocked.telegramId) {
      res.status(403).json({
        error: "Несовпадение telegramId в query с данными авторизации Telegram",
      });
      return;
    }
    const rawQ = req.query.search ?? req.query.q;
    const search =
      typeof rawQ === "string"
        ? rawQ
        : Array.isArray(rawQ) && typeof rawQ[0] === "string"
          ? rawQ[0]
          : undefined;
    const rows = await listBusinessesForPlatformAdmin(search);
    res.json(rows);
  } catch (e) {
    console.error("GET /api/platform/admin/businesses:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/platform/admin/disable", async (req: Request, res: Response) => {
  try {
    if (!(await requireOperatorRecentReauth(req, res))) return;
    const businessId = Number(
      (req.body as { businessId?: unknown }).businessId,
    );
    if (!Number.isInteger(businessId) || businessId <= 0) {
      res.status(400).json({ error: "Нужен корректный businessId" });
      return;
    }
    const exists = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    if (!exists) {
      res.status(404).json({ error: "Магазин не найден" });
      return;
    }
    await adminDeactivateBusiness(businessId);
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/platform/admin/disable:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/platform/admin/enable", async (req: Request, res: Response) => {
  try {
    if (!(await requireOperatorRecentReauth(req, res))) return;
    const businessId = Number(
      (req.body as { businessId?: unknown }).businessId,
    );
    if (!Number.isInteger(businessId) || businessId <= 0) {
      res.status(400).json({ error: "Нужен корректный businessId" });
      return;
    }
    const out = await adminEnableNonBlockedBusiness(businessId);
    if (!out.ok) {
      res.status(out.statusCode).json({ error: out.error });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/platform/admin/enable:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

/**
 * Повторно поднять клиентский бот: `setWebhook` + пересоздание Telegraf в памяти.
 * Нужен, когда витрина «Активна», но апдейты не доходят до процесса.
 */
app.post(
  "/api/platform/admin/restart-dynamic-bot",
  async (req: Request, res: Response) => {
    try {
      if (!(await requireOperatorRecentReauth(req, res))) return;
      const businessId = Number(
        (req.body as { businessId?: unknown }).businessId,
      );
      if (!Number.isInteger(businessId) || businessId <= 0) {
        res.status(400).json({ error: "Нужен корректный businessId" });
        return;
      }
      const row = await prisma.business.findUnique({
        where: { id: businessId },
        select: { id: true, botToken: true, isBlocked: true },
      });
      if (row == null) {
        res.status(404).json({ error: "Магазин не найден" });
        return;
      }
      if (row.isBlocked) {
        res.status(400).json({
          error: "Магазин заблокирован — сначала нажмите «Включить»",
        });
        return;
      }
      const tok = plainBotTokenFromStored(row.botToken);
      if (tok === "") {
        res.status(400).json({ error: "У магазина нет botToken" });
        return;
      }
      try {
        await initDynamicStoreBot({ businessId: row.id, botToken: tok });
      } catch (e) {
        console.error("POST restart-dynamic-bot init failed:", businessId, e);
        const msg =
          e instanceof Error ? e.message : "Не удалось перезапустить бота";
        res.status(502).json({ error: msg });
        return;
      }
      res.json({ ok: true });
    } catch (e) {
      console.error("POST /api/platform/admin/restart-dynamic-bot:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },
);

app.post("/api/platform/admin/extend", async (req: Request, res: Response) => {
  try {
    if (!(await requireOperatorRecentReauth(req, res))) return;
    const body = req.body as { businessId?: unknown; days?: unknown };
    const businessId = Number(body.businessId);
    const daysRaw = Number(body.days);
    const days = daysRaw === 30 || daysRaw === 90 ? daysRaw : null;
    if (!Number.isInteger(businessId) || businessId <= 0 || days == null) {
      res
        .status(400)
        .json({ error: "Нужны businessId и days: 30 или 90" });
      return;
    }
    const out = await extendBusinessSubscriptionAdmin(businessId, days);
    if (!out.ok) {
      res.status(out.statusCode).json({ error: out.message });
      return;
    }
    res.json({ ok: true, subscriptionEndsAt: out.subscriptionEndsAt });
  } catch (e) {
    console.error("POST /api/platform/admin/extend:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/platform/admin/purge-business", async (req: Request, res: Response) => {
  try {
    const unlocked = await requireOperatorRecentReauth(req, res);
    if (!unlocked) return;
    const businessId = Number(
      (req.body as { businessId?: unknown }).businessId,
    );
    if (!Number.isInteger(businessId) || businessId <= 0) {
      res.status(400).json({ error: "Нужен корректный businessId" });
      return;
    }
    const out = await purgeBusinessCompletelyForPlatformAdmin(
      businessId,
      unlocked.telegramId,
    );
    if (!out.ok) {
      res.status(out.statusCode).json({ error: out.message });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/platform/admin/purge-business:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.get("/api/platform/admin/template-info", async (req: Request, res: Response) => {
  try {
    if (!(await requireOperatorUnlock(req, res))) return;
    const bid = Number((req.query as { businessId?: string }).businessId);
    if (!Number.isInteger(bid) || bid <= 0) {
      res.status(400).json({ error: "Нужен query businessId" });
      return;
    }
    const b = await prisma.business.findUnique({ where: { id: bid } });
    if (!b) {
      res.status(404).json({ error: "Business not found" });
      return;
    }
    const bt = (b as any).businessType;
    const tpl = typeof bt === "string" ? templateForBusinessType(bt as any) : null;
    res.json({
      businessId: b.id,
      name: b.name,
      businessType: bt ?? null,
      templateId: (b as any).templateId ?? null,
      templateVersion: (b as any).templateVersion ?? null,
      schemas: tpl
        ? {
            productSchema: tpl.productSchema ?? {},
            merchantSettingsSchema: tpl.merchantSettingsSchema ?? {},
            orderOptionsSchema: tpl.orderOptionsSchema ?? {},
            templateVersion: tpl.templateVersion ?? 1,
          }
        : null,
    });
  } catch (e) {
    console.error("GET /api/platform/admin/template-info:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/platform/admin/reapply-template", async (req: Request, res: Response) => {
  try {
    if (!(await requireOperatorRecentReauth(req, res))) return;
    const bid = Number((req.body as { businessId?: unknown }).businessId);
    if (!Number.isInteger(bid) || bid <= 0) {
      res.status(400).json({ error: "Нужен корректный businessId" });
      return;
    }
    const b = await prisma.business.findUnique({ where: { id: bid } });
    if (!b) return res.status(404).json({ error: "Business not found" });
    const bt = (b as any).businessType;
    if (typeof bt !== "string" || bt.trim() === "") {
      return res.status(400).json({ error: "Business без businessType" });
    }
    const { applyBusinessTemplate } = await import("./applyBusinessTemplate.js");
    await applyBusinessTemplate({ prisma, businessId: bid, businessType: bt as any });
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/platform/admin/reapply-template:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/platform/admin/regenerate-demo", async (req: Request, res: Response) => {
  try {
    if (!(await requireOperatorRecentReauth(req, res))) return;
    const bid = Number((req.body as { businessId?: unknown }).businessId);
    if (!Number.isInteger(bid) || bid <= 0) {
      res.status(400).json({ error: "Нужен корректный businessId" });
      return;
    }
    const b = await prisma.business.findUnique({ where: { id: bid } });
    if (!b) return res.status(404).json({ error: "Business not found" });
    const bt = (b as any).businessType;
    if (typeof bt !== "string" || bt.trim() === "") {
      return res.status(400).json({ error: "Business без businessType" });
    }
    const { applyBusinessTemplate } = await import("./applyBusinessTemplate.js");
    await applyBusinessTemplate({
      prisma,
      businessId: bid,
      businessType: bt as any,
      forceDemo: true,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/platform/admin/regenerate-demo:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/platform/admin/migrate-template", async (req: Request, res: Response) => {
  try {
    if (!(await requireOperatorRecentReauth(req, res))) return;
    const bid = Number((req.body as { businessId?: unknown }).businessId);
    if (!Number.isInteger(bid) || bid <= 0) {
      res.status(400).json({ error: "Нужен корректный businessId" });
      return;
    }
    const b = await prisma.business.findUnique({ where: { id: bid } });
    if (!b) return res.status(404).json({ error: "Business not found" });
    const bt = (b as any).businessType;
    if (typeof bt !== "string" || bt.trim() === "") {
      return res.status(400).json({ error: "Business без businessType" });
    }
    const tpl = templateForBusinessType(bt as any);
    const { applyBusinessTemplate } = await import("./applyBusinessTemplate.js");
    await applyBusinessTemplate({ prisma, businessId: bid, businessType: bt as any, forceDemo: false });
    await prisma.business.update({ where: { id: bid }, data: { templateVersion: tpl.templateVersion ?? 1 } as any });
    res.json({ ok: true, templateVersion: tpl.templateVersion ?? 1 });
  } catch (e) {
    console.error("POST /api/platform/admin/migrate-template:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.get(
  "/api/platform/admin/bot-token-changes",
  async (req: Request, res: Response) => {
    try {
      if (!(await requireOperatorUnlock(req, res))) return;
      const rows = await listPendingMerchantChangeRequests();
      res.json(rows);
    } catch (e) {
      console.error("GET /api/platform/admin/bot-token-changes:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },
);

app.post(
  "/api/platform/admin/bot-token-changes/approve",
  async (req: Request, res: Response) => {
    try {
      if (!(await requireOperatorRecentReauth(req, res))) return;
      const id = Number((req.body as { id?: unknown }).id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "Нужен корректный id заявки" });
        return;
      }
      const out = await approveMerchantBotTokenChangeById(id);
      if (!out.ok) {
        res.status(out.statusCode).json({ error: out.message });
        return;
      }
      res.json({ ok: true, businessId: out.businessId });
    } catch (e) {
      console.error("POST .../bot-token-changes/approve:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },
);

app.post(
  "/api/platform/admin/bot-token-changes/reject",
  async (req: Request, res: Response) => {
    try {
      if (!(await requireOperatorRecentReauth(req, res))) return;
      const id = Number((req.body as { id?: unknown }).id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "Нужен корректный id заявки" });
        return;
      }
      const out = await rejectMerchantBotTokenChangeById(id);
      if (!out.ok) {
        res.status(out.statusCode).json({ error: out.message });
        return;
      }
      res.json({ ok: true });
    } catch (e) {
      console.error("POST .../bot-token-changes/reject:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },
);

app.use("/api", businessMiddleware);

app.put("/api/business/:businessId/theme", async (req: Request, res: Response) => {
  try {
    const bid = Number(req.params.businessId);
    if (!Number.isSafeInteger(bid) || bid <= 0) {
      res.status(400).json({ error: "Invalid business id" });
      return;
    }
    if (typeof req.businessId !== "number" || req.businessId !== bid) {
      res.status(403).json({
        error: "Укажите тот же магазин в query ?shop=",
      });
      return;
    }
    const m = req.tenantMembership;
    if (
      !m ||
      (m.role !== MembershipRole.OWNER && m.role !== MembershipRole.ADMIN)
    ) {
      res.status(403).json({ error: "Только владелец или админ магазина" });
      return;
    }

    const business = await prisma.business.findUnique({
      where: { id: bid },
      select: { themeConfig: true, templateId: true },
    });
    if (!business) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const body = req.body as { themeConfig?: unknown };
    const patch = body.themeConfig ?? body;
    const result = applyThemePatchAndValidate(
      business.themeConfig,
      business.templateId,
      patch,
    );
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }

    const patchTouchesLogo =
      patch !== null && typeof patch === "object" && "logoUrl" in patch;

    await prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id: bid },
        data: {
          themeConfig: result.themeConfig,
          templateId: result.templateId,
        },
      });
      if (patchTouchesLogo) {
        await tx.settings.upsert({
          where: { businessId: bid },
          create: {
            businessId: bid,
            logoUrl: result.merged.logoUrl,
          },
          update: {
            logoUrl: result.merged.logoUrl,
          },
        });
      }
    });

    invalidateStorefrontCache(bid);

    res.json({
      ok: true,
      themeConfig: result.merged,
      templateId: result.templateId,
    });
  } catch (e) {
    console.error("PUT /api/business/:id/theme:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/business/template", async (req: Request, res: Response) => {
  try {
    if (typeof req.businessId !== "number") {
      res.status(400).json({
        error: "Missing tenant: pass shop or businessId in query",
      });
      return;
    }
    const bid = req.businessId;
    const m = req.tenantMembership;
    if (
      !m ||
      (m.role !== MembershipRole.OWNER && m.role !== MembershipRole.ADMIN)
    ) {
      res.status(403).json({ error: "Только владелец или админ магазина" });
      return;
    }

    const raw = (req.body as { templateId?: unknown }).templateId;
    if (raw === undefined) {
      res.status(400).json({ error: "Нужен templateId" });
      return;
    }

    const business = await prisma.business.findUnique({
      where: { id: bid },
      select: { themeConfig: true, templateId: true },
    });
    if (!business) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const result = applyThemePatchAndValidate(
      business.themeConfig,
      business.templateId,
      { templateId: raw },
    );
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }

    await prisma.business.update({
      where: { id: bid },
      data: {
        themeConfig: result.themeConfig,
        templateId: result.templateId,
      },
    });

    invalidateStorefrontCache(bid);

    res.json({
      ok: true,
      themeConfig: result.merged,
      templateId: result.templateId,
    });
  } catch (e) {
    console.error("PUT /api/business/template:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/me", (req: Request, res: Response) => {
  try {
    if (typeof req.businessId !== "number" || req.tenantBusiness == null) {
      res.status(400).json({
        error: "Missing tenant: pass shop or businessId in query",
      });
      return;
    }
    const role =
      req.tenantMembership?.role ?? MembershipRole.CLIENT;
    const permissions =
      req.tenantMembership &&
      (role === MembershipRole.OWNER || role === MembershipRole.ADMIN)
        ? effectiveMerchantPermissions(
            req.tenantMembership.role,
            req.tenantMembership.permissions ?? [],
          )
        : [];
    res.json({
      role,
      permissions,
      businessId: req.businessId,
      telegramId:
        typeof req.tenantUser?.telegramId === "string"
          ? req.tenantUser.telegramId
          : null,
      businessName: req.tenantBusiness.name ?? null,
    });
  } catch (e) {
    console.error("GET /api/me:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/memberships", async (req: Request, res: Response) => {
  try {
    if (typeof req.businessId !== "number") {
      res.status(400).json({
        error: "Missing tenant: pass shop or businessId in query",
      });
      return;
    }

    const ownerCtx = await requireStoreOwnerForApi(
      req,
      res,
      req.businessId,
    );
    if (!ownerCtx) return;

    const rows = await prisma.membership.findMany({
      where: { businessId: req.businessId },
      include: {
        user: { select: { telegramId: true, name: true } },
      },
      orderBy: [{ role: "asc" }, { userId: "asc" }],
    });

    res.json(
      rows.map((m) => ({
        userId: m.userId,
        role: m.role,
        permissions: m.permissions ?? [],
        telegramId: m.user.telegramId,
        name: m.user.name ?? null,
      })),
    );
  } catch (e) {
    console.error("GET /api/memberships:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/memberships/update-role", async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      userId?: unknown;
      businessId?: unknown;
      role?: unknown;
    };

    const targetUserIdRaw = Number(body.userId);
    const businessBodyRaw = Number(body.businessId);
    const roleRaw = String(body.role ?? "").trim().toUpperCase();

    if (
      !Number.isSafeInteger(targetUserIdRaw) ||
      targetUserIdRaw <= 0 ||
      !Number.isSafeInteger(businessBodyRaw) ||
      businessBodyRaw <= 0
    ) {
      res.status(400).json({ error: "Нужны userId, businessId и role" });
      return;
    }

    let nextRole: MembershipRole | null = null;
    if (roleRaw === "ADMIN") nextRole = MembershipRole.ADMIN;
    else if (roleRaw === "CLIENT") nextRole = MembershipRole.CLIENT;

    if (nextRole == null) {
      res.status(400).json({ error: "role только ADMIN или CLIENT" });
      return;
    }

    if (typeof req.businessId !== "number") {
      res.status(400).json({
        error: "Missing tenant: pass shop or businessId in query",
      });
      return;
    }

    if (req.businessId !== businessBodyRaw) {
      res.status(403).json({ error: "Несовпадение магазина" });
      return;
    }

    const ownerCtx = await requireStoreOwnerForApi(
      req,
      res,
      req.businessId,
    );
    if (!ownerCtx) return;

    if (targetUserIdRaw === ownerCtx.requesterDbUserId) {
      res.status(403).json({ error: "Нельзя изменить собственную роль" });
      return;
    }

    const existing = await prisma.membership.findUnique({
      where: {
        userId_businessId: {
          userId: targetUserIdRaw,
          businessId: req.businessId,
        },
      },
    });

    if (!existing) {
      res.status(404).json({ error: "Участник не найден" });
      return;
    }

    if (existing.role === MembershipRole.OWNER) {
      res.status(403).json({ error: "Нельзя менять роль владельца" });
      return;
    }

    await prisma.membership.update({
      where: {
        userId_businessId: {
          userId: targetUserIdRaw,
          businessId: req.businessId,
        },
      },
      data: { role: nextRole },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/memberships/update-role:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/memberships/update-permissions", async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      userId?: unknown;
      businessId?: unknown;
      permissions?: unknown;
    };

    const targetUserIdRaw = Number(body.userId);
    const businessBodyRaw = Number(body.businessId);

    if (
      !Number.isSafeInteger(targetUserIdRaw) ||
      targetUserIdRaw <= 0 ||
      !Number.isSafeInteger(businessBodyRaw) ||
      businessBodyRaw <= 0
    ) {
      res.status(400).json({ error: "Нужны userId и businessId" });
      return;
    }

    if (typeof req.businessId !== "number") {
      res.status(400).json({
        error: "Missing tenant: pass shop or businessId in query",
      });
      return;
    }

    if (req.businessId !== businessBodyRaw) {
      res.status(403).json({ error: "Несовпадение магазина" });
      return;
    }

    const ownerCtx = await requireStoreOwnerForApi(
      req,
      res,
      req.businessId,
    );
    if (!ownerCtx) return;

    if (targetUserIdRaw === ownerCtx.requesterDbUserId) {
      res
        .status(403)
        .json({ error: "Нельзя изменить собственные права таким образом" });
      return;
    }

    const existing = await prisma.membership.findUnique({
      where: {
        userId_businessId: {
          userId: targetUserIdRaw,
          businessId: req.businessId,
        },
      },
    });

    if (!existing) {
      res.status(404).json({ error: "Участник не найден" });
      return;
    }

    if (existing.role === MembershipRole.OWNER) {
      res.status(403).json({ error: "У владельца права полные" });
      return;
    }

    if (existing.role !== MembershipRole.ADMIN) {
      res
        .status(400)
        .json({ error: "Права задаются только для администраторов" });
      return;
    }

    const permissions = sanitizeMerchantPermissionInput(body.permissions);

    await prisma.membership.update({
      where: {
        userId_businessId: {
          userId: targetUserIdRaw,
          businessId: req.businessId,
        },
      },
      data: { permissions },
    });

    res.json({ ok: true, permissions });
  } catch (e) {
    console.error("POST /api/memberships/update-permissions:", e);
    res.status(500).json({ error: "Server error" });
  }
});

/** Telegram пользователя запроса: заголовок (для тел JSON с полем userId как id в БД) → body.userId → query.userId */
function telegramIdFromRequest(req: Request): string | null {
  const rawXi = req.headers["x-telegram-id"];
  const xi =
    typeof rawXi === "string"
      ? rawXi.trim()
      : Array.isArray(rawXi) && typeof rawXi[0] === "string"
        ? rawXi[0].trim()
        : "";
  if (/^\d+$/.test(xi)) return xi;

  const rawBody = (req.body as { userId?: unknown } | undefined)?.userId;
  const rawQuery = req.query.userId;
  const raw = rawBody ?? (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery);
  if (raw === undefined || raw === null) return null;
  const telegramId = String(raw).trim();
  return telegramId ? telegramId : null;
}

const PUBLIC_BUSINESS_PARSE_ERROR = "Invalid businessId";
const PUBLIC_BUSINESS_MISSING_ERROR = "Not found";
const PUBLIC_BUSINESS_UNAVAILABLE_ERROR = "Store unavailable";

function queryParamToTrimmedString(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim();
  return "";
}

/** Строго: только строка из цифр, без `1e9`, пробелов после trim, только safe integer > 0. */
function parseTenantBusinessDigits(trimmedNonEmpty: string): number | undefined {
  if (trimmedNonEmpty === "") return undefined;
  if (!/^\d+$/.test(trimmedNonEmpty)) return undefined;
  const n = Number(trimmedNonEmpty);
  if (!Number.isSafeInteger(n) || n <= 0) return undefined;
  return n;
}

/**
 * Тенант витрины / публичных API: порядок `?businessId` → `?shop` → `x-business-id` → `body.businessId`.
 */
function businessIdFromNonApiHint(req: Request): number | null {
  const fromBid = parseTenantBusinessDigits(
    queryParamToTrimmedString(req.query.businessId)
  );
  if (fromBid !== undefined) return fromBid;

  const fromShop = parseTenantBusinessDigits(
    queryParamToTrimmedString(req.query.shop)
  );
  if (fromShop !== undefined) return fromShop;

  const rawH = req.headers["x-business-id"];
  const hdr =
    typeof rawH === "string"
      ? rawH.trim()
      : Array.isArray(rawH) && typeof rawH[0] === "string"
        ? rawH[0].trim()
        : "";
  const fromHeader = parseTenantBusinessDigits(hdr);
  if (fromHeader !== undefined) return fromHeader;

  const body = req.body as { businessId?: unknown } | undefined;
  const b = body?.businessId;
  if (typeof b === "number" && Number.isInteger(b)) {
    const fromBody = parseTenantBusinessDigits(String(b));
    if (fromBody !== undefined) return fromBody;
  }
  if (typeof b === "string") {
    const fromBody = parseTenantBusinessDigits(b.trim());
    if (fromBody !== undefined) return fromBody;
  }

  const rawShopBody = (req.body as { shop?: unknown } | undefined)?.shop;
  if (typeof rawShopBody === "string") {
    const fromShopBody = parseTenantBusinessDigits(rawShopBody.trim());
    if (fromShopBody !== undefined) return fromShopBody;
  }

  return null;
}

type MerchantStaffContext = {
  businessId: number;
  role: MembershipRole;
  effectivePermissions: MerchantPermissionId[];
};

/** Только OWNER магазина (Mini App уже привязан к tenant через middleware). */
async function requireStoreOwnerForApi(
  req: Request,
  res: Response,
  businessId: number,
): Promise<{ requesterDbUserId: number } | null> {
  const telegramId = telegramIdFromRequest(req);
  if (!telegramId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  if (typeof req.businessId !== "number" || req.businessId !== businessId) {
    res.status(403).json({ error: "Несовпадение магазина" });
    return null;
  }

  const requesterUser = await prisma.user.findUnique({
    where: { telegramId },
  });
  if (!requesterUser) {
    res.status(403).json({ error: "Нет доступа" });
    return null;
  }

  const m = await prisma.membership.findUnique({
    where: {
      userId_businessId: {
        userId: requesterUser.id,
        businessId,
      },
    },
  });
  if (!m || m.role !== MembershipRole.OWNER) {
    res.status(403).json({ error: "Только владелец магазина" });
    return null;
  }

  return { requesterDbUserId: requesterUser.id };
}

async function requireMerchantStaff(
  req: Request,
  res: Response,
  requiredPermission?: MerchantPermissionId | MerchantPermissionId[],
): Promise<MerchantStaffContext | null> {
  const telegramId = telegramIdFromRequest(req);
  const businessId = businessIdFromNonApiHint(req);
  if (!telegramId) {
    res.status(400).json({ error: "Нужен userId (Telegram)" });
    return null;
  }
  if (businessId == null) {
    res.status(400).json({
      error:
        "Укажите магазин: query shop=<businessId>, заголовок x-business-id или body.businessId",
    });
    return null;
  }

  const userRecord = await prisma.user.findUnique({
    where: { telegramId },
  });
  const membershipRecord =
    userRecord == null
      ? null
      : await prisma.membership.findUnique({
          where: {
            userId_businessId: { userId: userRecord.id, businessId },
          },
        });

  if (
    !membershipRecord ||
    (membershipRecord.role !== MembershipRole.OWNER &&
      membershipRecord.role !== MembershipRole.ADMIN)
  ) {
    res.status(403).json({ error: "Нет доступа к этому магазину" });
    return null;
  }

  const effectivePermissions = effectiveMerchantPermissions(
    membershipRecord.role,
    membershipRecord.permissions ?? [],
  );

  if (
    requiredPermission != null &&
    !merchantHasPermission(effectivePermissions, requiredPermission)
  ) {
    res.status(403).json({ error: "Недостаточно прав" });
    return null;
  }

  return {
    businessId,
    role: membershipRecord.role,
    effectivePermissions,
  };
}

/** Каталог / settings / заказы клиента по магазину: валидный id + строка Business в БД. */
async function resolveCatalogBusinessId(
  req: Request,
  res: Response
): Promise<number | null> {
  const businessId = businessIdFromNonApiHint(req);
  if (businessId == null) {
    res.status(400).json({ error: PUBLIC_BUSINESS_PARSE_ERROR });
    return null;
  }
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      isActive: true,
      isBlocked: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
    },
  });
  if (!business) {
    res.status(404).json({ error: PUBLIC_BUSINESS_MISSING_ERROR });
    return null;
  }
  if (isStorefrontClosedForCustomers(business)) {
    res.status(403).json({ error: PUBLIC_BUSINESS_UNAVAILABLE_ERROR });
    return null;
  }
  return business.id;
}

async function upsertBuyerUser(
  tx: Prisma.TransactionClient,
  businessId: number,
  telegramId: string,
  fallbackName: string | null
) {
  const normalizedName =
    fallbackName !== undefined &&
    fallbackName !== null &&
    String(fallbackName).trim() !== ""
      ? String(fallbackName).trim()
      : null;

  const u = await tx.user.upsert({
    where: { telegramId },
    create: { telegramId, name: normalizedName },
    update: normalizedName != null ? { name: normalizedName } : {},
  });

  await tx.membership.upsert({
    where: {
      userId_businessId: { userId: u.id, businessId },
    },
    create: {
      userId: u.id,
      businessId,
      role: MembershipRole.CLIENT,
    },
    update: {},
  });

  return u;
}

const publicApiBase = publicApiOrigin();

app.post(
  "/telegram-webhook/:botIndex",
  telegramWebhookGate,
  async (req: Request, res: Response) => {
    const idx = Number(req.params.botIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= bots.length) {
      return res.sendStatus(404);
    }
    const tBot = bots[idx];
    if (!tBot) {
      return res.sendStatus(503);
    }
    try {
      await tBot.handleUpdate(req.body);
      return res.sendStatus(200);
    } catch (e) {
      console.error(
        "telegram-webhook handler error:",
        idx,
        e instanceof Error ? e.message : String(e),
      );
      return res.sendStatus(500);
    }
  }
);

/** Старые деплои с одним ботом: тот же обработчик, что бот[0]. */
app.post(
  "/telegram-webhook",
  telegramWebhookGate,
  async (req: Request, res: Response) => {
    if (!bots[0]) {
      return res.sendStatus(503);
    }
    try {
      await bots[0].handleUpdate(req.body);
      return res.sendStatus(200);
    } catch (e) {
      console.error(
        "telegram-webhook (legacy) handler error:",
        e instanceof Error ? e.message : String(e),
      );
      return res.sendStatus(500);
    }
  }
);

/**
 * Tenant store bots: Telegram `setWebhook` → `POST {API_URL}/webhook/<business.webhookRouteToken>`.
 * Должен совпадать с сегментом в `dynamicWebhookPathForBusiness` (`/webhook/${webhookRouteToken}`).
 */
app.post(
  "/webhook/:webhookRouteToken",
  telegramWebhookGate,
  async (req: Request, res: Response) => {
    const webhookRouteToken = String(req.params.webhookRouteToken ?? "").trim();
    console.log("WEBHOOK HIT:", req.params);
    console.log("BODY:", req.body);

    let businessId: number | null = null;

    if (isHexWebhookSlug(webhookRouteToken)) {
      const business = await prisma.business.findUnique({
        where: { webhookRouteToken },
        select: { id: true },
      });
      businessId = business?.id ?? null;
    } else if (
      legacyNumericWebhookPathEnabled() &&
      /^\d+$/.test(webhookRouteToken)
    ) {
      const id = Number(webhookRouteToken);
      businessId =
        Number.isInteger(id) && id > 0 ? id : null;
    }

    console.log(
      "[webhook] slug → business:",
      webhookRouteToken.length >= 10
        ? `${webhookRouteToken.slice(0, 10)}…`
        : webhookRouteToken,
      "businessId:",
      businessId,
    );

    if (businessId == null) {
      res.sendStatus(404);
      return;
    }
    await relayDynamicTenantStoreWebhook(req, res, businessId);
  },
);

/** Совместимость: старые URL с числовым id в пути. */
app.post(
  "/telegram-webhook/owner/:businessId",
  telegramWebhookGate,
  async (req: Request, res: Response) => {
    const businessId = Number(req.params.businessId);
    if (!Number.isInteger(businessId) || businessId <= 0) {
      res.sendStatus(404);
      return;
    }
    await relayDynamicTenantStoreWebhook(req, res, businessId);
  },
);

/** Сохранить токен @BotFather и зарегистрировать бота (вебхук + /start). */
app.post("/connect-bot", async (req: Request, res: Response) => {
  try {
    const telegramId = telegramIdFromRequest(req);
    if (!telegramId) {
      return res.status(400).json({ error: "Нужен userId (Telegram)" });
    }
    const body = req.body as { botToken?: unknown; businessId?: unknown };
    const businessId = Number(body.businessId);
    if (!Number.isInteger(businessId) || businessId <= 0) {
      return res.status(400).json({ error: "Нужен businessId магазина" });
    }
    const merchant = await prisma.membership.findFirst({
      where: {
        businessId,
        user: { telegramId },
        role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN] },
      },
    });
    if (!merchant) {
      return res
        .status(403)
        .json({ error: "Нет доступа к управлению ботом этого магазина" });
    }
    const token = String(body.botToken ?? "").replace(/\s/g, "").trim();
    if (!token) {
      return res.status(400).json({ error: "Вставьте токен бота" });
    }

    const meRes = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`
    );
    const meJson = (await meRes.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: { username?: string; id?: number };
    };
    if (!meRes.ok || !meJson.ok || !meJson.result) {
      return res.status(400).json({ error: "Недействительный токен бота" });
    }

    const conflict = await prisma.business.findFirst({
      where: {
        botTokenHash: hashBotTokenSha256Hex(token),
        NOT: { id: businessId },
      },
    });
    if (conflict) {
      return res
        .status(409)
        .json({ error: "Этот бот уже подключён к другому магазину" });
    }

    await prisma.business.update({
      where: { id: businessId },
      data: encryptedBotTokenRow(token),
    });

    await initDynamicStoreBot({ businessId, botToken: token });

    return res.json({
      ok: true,
      shopId: businessId,
      botUsername: meJson.result.username ?? "",
    });
  } catch (e) {
    console.error("connect-bot:", e);
    return res.status(500).json({ error: "Не удалось подключить бота" });
  }
});

// ================== ROOT ==================
app.get("/", (_req: Request, res: Response, next: NextFunction) => {
  if (SPA_AVAILABLE) {
    sendSpaIndexHtml(res, next);
  } else {
    res.type("text").send("Server is working 🚀");
  }
});

app.get("/test-telegram", async (req: Request, res: Response) => {
  try {
    if (!bot) {
      return res.status(500).json({ error: "BOT_UNDEFINED" });
    }

    const target = getNotifyTargetChatId();
    if (target == null) {
      return res.status(400).json({
        error:
          "Задайте CHAT_ID в .env или откройте бота и отправьте /start, чтобы задать чат для уведомлений",
      });
    }

    const result = await bot.telegram.sendMessage(
      target,
      "Проверка: сервер достучался до Telegram ✅"
    );

    res.json({ ok: true, result });
  } catch (e) {
    console.error("TELEGRAM ERROR FULL:", e);
    res.status(500).json({ error: String(e) });
  }
});

// ================== CHECK ADMIN ==================
/** Мини-приложение: только OWNER / ADMIN этого `shop`/`businessId` (платформенные ADMIN_IDS не дают доступ к чужим данным). */
app.post("/check-admin", async (req: Request, res: Response) => {
  try {
    const uid = adminUserIdFromRequest(req);
    const body = req.body as { shop?: unknown; businessId?: unknown };
    const shopRaw = body.shop ?? body.businessId;
    const shop =
      typeof shopRaw === "number" &&
      Number.isInteger(shopRaw) &&
      shopRaw > 0
        ? shopRaw
        : typeof shopRaw === "string"
          ? Number(shopRaw.trim())
          : NaN;

    if (Number.isInteger(shop) && shop > 0) {
      const tid = String(uid ?? "").trim();
      const mship =
        tid === ""
          ? null
          : await prisma.membership.findFirst({
              where: {
                businessId: shop,
                user: { telegramId: tid },
                role: {
                  in: [MembershipRole.OWNER, MembershipRole.ADMIN],
                },
              },
            });
      res.json({ isAdmin: mship != null });
      return;
    }

    res.json({ isAdmin: false });
  } catch (e) {
    console.error("CHECK-ADMIN:", e);
    res.status(500).json({ isAdmin: false });
  }
});

// ================== TELEGRAM MERCHANT DASHBOARD (Mini App) ==================
async function merchantMyBusinessesHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const raw = req.query.telegramId ?? req.query.userId;
    const s = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
    const telegramId = String(s ?? "").trim();
    if (telegramId === "" || !/^\d+$/.test(telegramId)) {
      res.status(400).json({
        error: "Нужен query telegramId (или userId) — числовой Telegram id",
      });
      return;
    }
    const businesses = await listMerchantOwnedBusinesses(telegramId);
    res.json({ businesses });
  } catch (e) {
    console.error("GET /my-businesses:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
}

app.get("/my-businesses", merchantMyBusinessesHandler);
app.get("/api/my-businesses", merchantMyBusinessesHandler);

app.post("/api/platform/funnel/events", async (req: Request, res: Response) => {
  try {
    const telegramId = platformTelegramIdFromWebApp(req);
    const body = req.body as {
      events?: Array<{
        step?: unknown;
        businessId?: unknown;
        meta?: unknown;
      }>;
    };
    const raw = Array.isArray(body?.events) ? body.events : [];
    const count = await ingestPlatformFunnelEvents(
      raw.map((ev) => ({
        step: String(ev.step ?? ""),
        telegramId,
        businessId:
          typeof ev.businessId === "number" && ev.businessId > 0
            ? ev.businessId
            : null,
        meta:
          ev.meta != null && typeof ev.meta === "object" && !Array.isArray(ev.meta)
            ? (ev.meta as Record<string, unknown>)
            : {},
      })),
    );
    res.json({ ok: true, ingested: count });
  } catch (e) {
    console.error("POST /api/platform/funnel/events:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/platform/feedback", async (req: Request, res: Response) => {
  try {
    const telegramId = platformTelegramIdFromWebApp(req);
    const body = req.body as {
      kind?: unknown;
      message?: unknown;
      businessId?: unknown;
      page?: unknown;
    };
    const message = typeof body.message === "string" ? body.message : "";
    const kind = typeof body.kind === "string" ? body.kind : "other";
    const businessId =
      typeof body.businessId === "number" && body.businessId > 0
        ? body.businessId
        : null;
    const page = typeof body.page === "string" ? body.page : null;
    const row = await createProductFeedback({
      kind,
      message,
      telegramId,
      businessId,
      page,
    });
    res.status(201).json({ ok: true, id: row.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "MESSAGE_TOO_SHORT") {
      return res.status(400).json({ error: "Сообщение слишком короткое" });
    }
    console.error("POST /api/platform/feedback:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.get("/api/platform/store-readiness", async (req: Request, res: Response) => {
  try {
    const telegramId = platformTelegramIdFromWebApp(req);
    if (!telegramId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const bidRaw = req.query.businessId;
    const businessId = Number(
      typeof bidRaw === "string" ? bidRaw : Array.isArray(bidRaw) ? bidRaw[0] : NaN,
    );
    if (!Number.isInteger(businessId) || businessId <= 0) {
      return res.status(400).json({ error: "Нужен businessId" });
    }
    const owned = await prisma.membership.findFirst({
      where: {
        businessId,
        role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN] },
        user: { telegramId },
      },
      select: { id: true },
    });
    if (!owned) {
      return res.status(403).json({ error: "Нет доступа" });
    }
    const payload = await buildMerchantGrowth(businessId);
    res.json(payload);
  } catch (e) {
    console.error("GET /api/platform/store-readiness:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/telemetry/client-error", async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      message?: unknown;
      page?: unknown;
      component?: unknown;
    };
    const message = String(body.message ?? "").trim().slice(0, 500);
    if (message.length < 2) {
      return res.status(400).json({ error: "Invalid" });
    }
    console.warn("[client-error]", {
      message,
      page: typeof body.page === "string" ? body.page.slice(0, 128) : null,
      component:
        typeof body.component === "string" ? body.component.slice(0, 64) : null,
      ts: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/telemetry/client-error:", e);
    res.status(500).json({ error: "Ошибка" });
  }
});

// ================== UPLOAD (Cloudinary, только персонал магазина) ==================
app.post(
  "/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    const m = await requireMerchantStaff(req, res, [
      MERCHANT_PERM.designEdit,
      MERCHANT_PERM.catalogEdit,
    ]);
    if (!m) return;
    try {
      if (!isCloudinaryConfigured()) {
        return res.status(503).json({
          error:
            "Cloudinary не настроен (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)",
        });
      }
      const file = req.file;
      if (!file?.buffer?.length) {
        return res.status(400).json({ error: "Нет файла" });
      }
      const v = validateImageFile({ mimetype: file.mimetype, sizeBytes: file.size });
      if (!v.ok) return res.status(400).json({ error: v.error });
      const asset = await uploadTenantImage({
        businessId: m.businessId,
        kind: "storefront",
        buffer: file.buffer,
        mimetype: v.mimetype,
      });
      res.json(asset);
    } catch (e) {
      console.error("UPLOAD ERROR:", e);
      res.status(500).json({ error: "upload failed" });
    }
  }
);

app.post(
  "/products/upload-images",
  upload.array("files", 15),
  async (req: Request, res: Response) => {
    const m = await requireMerchantStaff(req, res, MERCHANT_PERM.catalogEdit);
    if (!m) return;
    try {
      if (!isCloudinaryConfigured()) {
        return res.status(503).json({
          error:
            "Cloudinary не настроен (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)",
        });
      }
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files?.length) {
        return res.status(400).json({ error: "Нет файлов" });
      }
      const assets: any[] = [];
      for (const file of files) {
        if (!file.buffer?.length) continue;
        const v = validateImageFile({ mimetype: file.mimetype, sizeBytes: file.size });
        if (!v.ok) continue;
        const asset = await uploadTenantImage({
          businessId: m.businessId,
          kind: "products",
          buffer: file.buffer,
          mimetype: v.mimetype,
        });
        assets.push(asset);
      }
      if (assets.length === 0) {
        return res.status(400).json({ error: "Пустые файлы" });
      }
      res.json({ assets });
    } catch (e) {
      console.error("UPLOAD-IMAGES ERROR:", e);
      res.status(500).json({ error: "upload failed" });
    }
  }
);

// ================== PAYMENT (tenant Settings) ==================
app.get("/settings", async (req: Request, res: Response) => {
  try {
    const businessId = await resolveCatalogBusinessId(req, res);
    if (!businessId) return;
    let settings = await prisma.settings.findUnique({
      where: { businessId },
    });
    if (!settings) {
      settings = await prisma.settings.create({
        data: { businessId },
      });
    }
    // `other` — совместимый алиас для клиентов, ожидающих это поле.
    return res.json({
      ...settings,
      other: settings.other,
    });
  } catch (e) {
    console.error("GET /settings ERROR:", e);
    return res.status(500).json({ error: "Failed to load settings" });
  }
});

app.post("/settings", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
    if (!merchant) return;
    const body = req.body as Record<string, unknown>;
    const data = {
      mbank: body.mbank,
      optima: body.optima,
      obank: body.obank ?? body.other,
      card: body.card,
      qr: body.qr,
    } as Record<string, unknown>;
    const settings = await upsertPaymentSettings(
      prisma,
      merchant.businessId,
      data
    );
    return res.json({
      ...settings,
      other: settings.other,
    });
  } catch (e) {
    console.error("POST /settings ERROR:", e);
    return res.status(500).json({ error: "Failed to save settings" });
  }
});

app.post("/payment/list", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
    if (!merchant) return;
    res.json(await listPaymentDetailsFromDb(prisma, merchant.businessId));
  } catch (e) {
    console.error("PAYMENT LIST ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/payment", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
    if (!merchant) return;
    const saved = await upsertPaymentSettings(
      prisma,
      merchant.businessId,
      req.body as Record<string, unknown>
    );
    res.json(saved);
  } catch (e) {
    console.error("PAYMENT ERROR:", e);
    res.status(500).json({ error: "Failed to save payment" });
  }
});

app.delete("/payment/:id", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
    if (!merchant) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }

    const ok = await clearPaymentFieldByRowId(prisma, merchant.businessId, id);
    if (!ok) {
      return res.status(404).json({ error: "Не найдено" });
    }

    res.status(204).send();
  } catch (e) {
    console.error("PAYMENT DELETE ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// ================== PROMO (Prisma) ==================
app.post("/promo/apply", async (req: Request, res: Response) => {
  try {
    const { code, total, businessId: bid } = req.body as {
      code?: unknown;
      total?: unknown;
      businessId?: unknown;
    };
    const businessIdParsed =
      typeof bid === "number" && Number.isInteger(bid)
        ? parseTenantBusinessDigits(String(bid))
        : typeof bid === "string"
          ? parseTenantBusinessDigits(String(bid).trim())
          : undefined;
    const t = Number(total);
    if (
      code == null ||
      String(code).trim() === "" ||
      !Number.isFinite(t) ||
      businessIdParsed === undefined
    ) {
      return res.status(400).json({ error: "Нужны businessId, code и total" });
    }

    const businessRow = await prisma.business.findUnique({
      where: { id: businessIdParsed },
      select: { id: true },
    });
    if (!businessRow) {
      return res.status(404).json({ error: PUBLIC_BUSINESS_MISSING_ERROR });
    }

    const businessId = businessIdParsed;
    try {
      const result = await tryApplyPromoDb(prisma, businessId, String(code), t);
      return res.json({
        success: true,
        newTotal: result.newTotal,
        discount: result.discount,
      });
    } catch (e) {
      const msg = promoApplyErrorMessage(e);
      const status = msg === "Промокод не найден" ? 404 : 400;
      return res.status(status).json({ error: msg });
    }
  } catch (e) {
    console.error("PROMO APPLY ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/promo/list", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
    if (!merchant) return;
    res.json(await listPromosFromDb(prisma, merchant.businessId));
  } catch (e) {
    console.error("PROMO LIST ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/promo", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
    if (!merchant) return;
    const body = req.body as {
      code?: unknown;
      discount?: unknown;
      maxUses?: unknown;
      limit?: unknown;
    };
    const lim = body.limit ?? body.maxUses;
    const row = await createPromoDb(
      prisma,
      merchant.businessId,
      String(body.code ?? ""),
      Number(body.discount),
      Number(lim)
    );
    return res.status(201).json(row);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(409).json({ error: "Такой код уже есть" });
    }
    const msg = e instanceof Error ? e.message : "";
    if (msg === "EMPTY_CODE") {
      return res.status(400).json({ error: "Укажите code" });
    }
    if (msg === "BAD_DISCOUNT") {
      return res.status(400).json({ error: "discount от 0 до 100" });
    }
    if (msg === "BAD_MAX_USES") {
      return res.status(400).json({ error: "maxUses / limit — целое число ≥ 1" });
    }
    console.error("PROMO POST ERROR:", e);
    return res.status(500).json({ error: "Failed to save promo" });
  }
});

app.delete("/promo/:code", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
    if (!merchant) return;
    const codeParam = req.params.code;
    const encoded =
      typeof codeParam === "string"
        ? codeParam
        : Array.isArray(codeParam)
          ? (codeParam[0] ?? "")
          : "";
    const raw = decodeURIComponent(encoded);
    const ok = await deletePromoByCodeDb(prisma, merchant.businessId, raw);
    if (!ok) {
      return res.status(404).json({ error: "Промокод не найден" });
    }

    res.status(204).send();
  } catch (e) {
    console.error("PROMO DELETE ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// ================== CATEGORIES ==================
app.get("/categories", async (_req: Request, res: Response) => {
  try {
    const businessId = await resolveCatalogBusinessId(_req, res);
    if (!businessId) return;
    const categories = await prisma.category.findMany({
      where: { businessId },
      orderBy: { id: "asc" },
      include: { _count: { select: { products: true } } },
    });

    type Row = (typeof categories)[number];
    const byId = new Map<number, Row>();
    for (const c of categories) byId.set(c.id, c);

    const nodeById = new Map<
      number,
      {
        id: number;
        name: string;
        parentId: number | null;
        productsCount: number;
        config: unknown;
        children: any[];
      }
    >();

    for (const c of categories) {
      nodeById.set(c.id, {
        id: c.id,
        name: c.name,
        parentId: (c as unknown as { parentId?: number | null }).parentId ?? null,
        productsCount: c._count.products,
        config: (c as unknown as { config?: unknown }).config ?? {},
        children: [],
      });
    }

    const roots: any[] = [];
    for (const c of categories) {
      const node = nodeById.get(c.id)!;
      const parentId =
        (c as unknown as { parentId?: number | null }).parentId ?? null;
      if (parentId == null) {
        roots.push(node);
        continue;
      }
      const parent = nodeById.get(parentId);
      if (!parent) {
        roots.push(node);
        continue;
      }
      parent.children.push(node);
    }

    res.json(roots);
  } catch (e) {
    console.error("GET CATEGORIES ERROR:", e);
    res.status(500).json({ error: "Ошибка получения категорий" });
  }
});

app.post("/categories", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.catalogEdit);
    if (!merchant) return;
    const body = req.body as { name?: unknown; parentId?: unknown };
    const name = String(body.name ?? "").trim();
    if (!name) {
      return res.status(400).json({ error: "Укажите название категории" });
    }
    const parentIdRaw = body.parentId;
    const parentId =
      parentIdRaw == null || parentIdRaw === ""
        ? null
        : Number(parentIdRaw);
    if (parentId != null && !Number.isFinite(parentId)) {
      return res.status(400).json({ error: "Неверный parentId" });
    }
    if (parentId != null) {
      const parent = await prisma.category.findUnique({
        where: { id: parentId },
        select: { id: true, businessId: true },
      });
      if (!parent || parent.businessId !== merchant.businessId) {
        return res.status(400).json({ error: "Неверная родительская категория" });
      }
    }
    const category = await prisma.category.create({
      // Prisma Client types may lag schema changes in editor; runtime column exists after migration.
      data: {
        name,
        businessId: merchant.businessId,
        parentId,
      } as any,
    });
    res.json(category);
  } catch (e) {
    console.error("CREATE CATEGORY ERROR:", e);
    res.status(500).json({ error: "Failed to create category" });
  }
});

app.delete("/categories/:id", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.catalogEdit);
    if (!merchant) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }
    const row = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } },
      },
    });
    if (!row) {
      return res.status(404).json({ error: "Категория не найдена" });
    }
    if (row.businessId !== merchant.businessId) {
      return res.status(404).json({ error: "Категория не найдена" });
    }
    if (row._count.products > 0) {
      return res.status(400).json({ error: "Категория содержит товары" });
    }
    await prisma.category.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    console.error("DELETE CATEGORY ERROR:", e);
    res.status(500).json({ error: "Ошибка удаления категории" });
  }
});

app.put("/categories/:id/config", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.catalogEdit);
    if (!merchant) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }

    const exists = await prisma.category.findUnique({
      where: { id },
      select: { id: true, businessId: true },
    });
    if (!exists || exists.businessId !== merchant.businessId) {
      return res.status(404).json({ error: "Категория не найдена" });
    }

    const config =
      req.body != null && typeof req.body === "object" && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : null;
    if (!config) {
      return res.status(400).json({ error: "Нужен JSON объект config" });
    }

    const updated = await prisma.category.update({
      where: { id },
      data: { config } as any,
    });
    res.json(updated);
  } catch (e) {
    console.error("UPDATE CATEGORY CONFIG ERROR:", e);
    res.status(500).json({ error: "Ошибка обновления config" });
  }
});

// ================== CREATE PRODUCT ==================
app.post("/products", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.catalogEdit);
    if (!merchant) return;
    const body = req.body as {
      name?: unknown;
      price?: unknown;
      image?: unknown;
      images?: unknown;
      description?: unknown;
      categoryId?: unknown;
      attributes?: unknown;
    };

    const { name, price, image, images, description, categoryId, attributes } =
      body;

    const rawImages = Array.isArray(images)
      ? (images as unknown[])
          .filter((u) => u != null && String(u).trim() !== "")
          .map((u) => String(u).trim())
      : [];
    const imageStr =
      typeof image === "string" && image.trim() !== "" ? image.trim() : "";
    const imageList =
      rawImages.length > 0 ? rawImages : imageStr ? [imageStr] : [];
    const primaryImage = imageList[0] ?? "";

    if (!name || price == null || !primaryImage) {
      return res.status(400).json({ error: "Неверные данные" });
    }
    const normalizedCategoryId = Number(categoryId);
    if (!Number.isFinite(normalizedCategoryId)) {
      return res.status(400).json({ error: "Нужна категория" });
    }
    const category = await prisma.category.findUnique({
      where: { id: normalizedCategoryId },
      select: { id: true, businessId: true },
    });
    if (!category || category.businessId !== merchant.businessId) {
      return res.status(400).json({ error: "Неверная категория" });
    }

    const b = await prisma.business.findUnique({
      where: { id: merchant.businessId },
      select: { id: true } as any,
    });
    const b2 = await prisma.business.findUnique({
      where: { id: merchant.businessId },
    });
    const businessType = (b2 as any)?.businessType;
    if (typeof businessType !== "string" || businessType.trim() === "") {
      return res.status(400).json({ error: "Магазин без businessType" });
    }
    const vAttr = validateProductAttributes(
      businessType as any,
      attributes,
    );
    if (!vAttr.ok) {
      return res.status(400).json({ error: vAttr.error, details: vAttr.details });
    }

    const product = await prisma.product.create({
      // Prisma Client types may lag schema changes in editor; runtime column exists after migration.
      data: {
        name: String(name),
        price: Number(price),
        image: primaryImage,
        images: imageList,
        description:
          description != null && String(description).trim() !== ""
            ? String(description).trim()
            : null,
        categoryId: normalizedCategoryId,
        businessId: merchant.businessId,
        attributes: vAttr.value,
      } as any,
      include: {
        category: true,
      },
    });

    res.json(product);
  } catch (e) {
    console.error("PRISMA ERROR:", e);
    res.status(500).json({ error: "Ошибка создания товара" });
  }
});

/** Prisma может вернуть `BigInt` (например `user.telegramId`) — `res.json` без этого падает. */
function jsonWithBigInt<T>(data: T): unknown {
  return JSON.parse(
    JSON.stringify(data as object, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

async function performOrderStatusUpdate(
  orderId: number,
  businessId: number,
  statusRaw: unknown
): Promise<
  | { ok: true; body: unknown }
  | { ok: false; statusCode: number; error: string }
> {
  const stRaw = String(statusRaw ?? "");
  console.log("ORDER STATUS:", stRaw);
  if (!isValidOrderStatus(stRaw)) {
    return { ok: false, statusCode: 400, error: "Нужен допустимый status" };
  }
  const st: OrderStatus = stRaw as OrderStatus;
  try {
    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      include: { buyerUser: true },
    });
    if (!existing || existing.businessId !== businessId) {
      return { ok: false, statusCode: 404, error: "Заказ не найден" };
    }
    const cur = existing.status as OrderStatus;
    if (cur === st) {
      return { ok: true, body: existing };
    }
    if (
      !isAllowedOrderStatusTransition(cur, st, {
        paymentMethod: existing.paymentMethod,
      })
    ) {
      return {
        ok: false,
        statusCode: 400,
        error: "Неверный переход статуса",
      };
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: st },
      include: { buyerUser: true },
    });
    void notifyAfterOrderStatusChangeFromApi({
      id: updated.id,
      orderNumber: updated.orderNumber,
      businessId: updated.businessId,
      status: updated.status,
      total: updated.total,
      buyerUser: updated.buyerUser,
      paymentMethod: updated.paymentMethod,
    });
    return { ok: true, body: updated };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return { ok: false, statusCode: 404, error: "Заказ не найден" };
    }
    console.error("ORDER STATUS ERROR:", e);
    return { ok: false, statusCode: 500, error: "fail" };
  }
}

app.post("/order/status", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.ordersManage);
    if (!merchant) return;

    const { id, status } = req.body as {
      id?: unknown;
      status?: unknown;
    };

    const orderId = Number(id);
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ error: "Нужен id" });
    }

    const result = await performOrderStatusUpdate(
      orderId,
      merchant.businessId,
      status
    );
    if (!result.ok) {
      return res.status(result.statusCode).json({ error: result.error });
    }
    return res.json(jsonWithBigInt(result.body));
  } catch (e) {
    console.error("ORDER STATUS ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/orders/:id/status", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.ordersManage);
    if (!merchant) return;
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ error: "Неверный id" });
    }
    const { status } = req.body as { status?: unknown };
    const result = await performOrderStatusUpdate(
      orderId,
      merchant.businessId,
      status
    );
    if (!result.ok) {
      return res.status(result.statusCode).json({ error: result.error });
    }
    return res.json(jsonWithBigInt(result.body));
  } catch (e) {
    console.error("PUT ORDER STATUS ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

async function handleAdminOrderPatch(req: Request, res: Response) {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.ordersManage);
    if (!merchant) return;
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ error: "Неверный id" });
    }
    const body = req.body as { status?: unknown; tracking?: unknown };
    const hasTracking = Object.prototype.hasOwnProperty.call(body, "tracking");
    const hasStatus =
      body.status !== undefined &&
      body.status !== null &&
      String(body.status).trim() !== "";

    if (!hasStatus && !hasTracking) {
      return res
        .status(400)
        .json({ error: "Укажите status и/или tracking" });
    }

    const data: { status?: OrderStatus; tracking?: string | null } = {};
    if (hasTracking) {
      const t = body.tracking;
      data.tracking =
        t === null || t === undefined || String(t).trim() === ""
          ? null
          : String(t).trim();
    }
    if (hasStatus) {
      const stRaw = String(body.status);
      if (!isValidOrderStatus(stRaw)) {
        return res.status(400).json({ error: "Нужен допустимый status" });
      }
      data.status = stRaw as OrderStatus;
    }

    const exists = await prisma.order.findUnique({ where: { id: orderId } });
    if (!exists || exists.businessId !== merchant.businessId) {
      return res.status(404).json({ error: "Заказ не найден" });
    }

    if (hasStatus && data.status !== undefined) {
      const cur = exists.status as OrderStatus;
      if (
        cur !== data.status &&
        !isAllowedOrderStatusTransition(cur, data.status, {
          paymentMethod: exists.paymentMethod,
        })
      ) {
        return res.status(400).json({ error: "Неверный переход статуса" });
      }
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data,
      include: { buyerUser: true },
    });

    if (
      hasStatus &&
      data.status !== undefined &&
      exists.status !== data.status
    ) {
      void notifyAfterOrderStatusChangeFromApi({
        id: updated.id,
        orderNumber: updated.orderNumber,
        businessId: updated.businessId,
        status: updated.status,
        total: updated.total,
        buyerUser: updated.buyerUser,
        paymentMethod: updated.paymentMethod,
      });
    }

    return res.json(jsonWithBigInt(updated));
  } catch (e) {
    console.error("PATCH/PUT ORDER ERROR:", e);
    res.status(500).json({ error: "Update failed" });
  }
}

app.put("/orders/:id", handleAdminOrderPatch);
app.patch("/orders/:id", handleAdminOrderPatch);

app.delete("/orders/clear", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.ordersManage);
    if (!merchant) return;

    const rawType = Array.isArray(req.query.type)
      ? req.query.type[0]
      : req.query.type;
    const type = String(rawType ?? "all").toLowerCase();

    // Исторические алиасы из UI:
    // - completed -> SHIPPED | DELIVERED (финальные успешные статусы)
    // - rejected  -> CANCELLED (отклонён/отменён)
    const baseWhere: Prisma.OrderWhereInput = {
      businessId: merchant.businessId,
    };
    let statusFilter: Prisma.EnumOrderStatusFilter | undefined;
    if (type === "completed") {
      statusFilter = { in: ["SHIPPED", "DELIVERED"] };
    } else if (type === "rejected") {
      statusFilter = { equals: "CANCELLED" };
    } else if (type !== "all") {
      return res.status(400).json({ error: "Unsupported clear type" });
    }

    const deleted = await prisma.order.deleteMany({
      where:
        statusFilter != null ? { ...baseWhere, status: statusFilter } : baseWhere,
    });
    return res.json({ deleted: deleted.count });
  } catch (e) {
    console.error("DELETE /orders/clear:", e);
    return res.status(500).json({ error: "Clear failed" });
  }
});

app.post("/analytics", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.analyticsView);
    if (!merchant) return;

    const body = req.body as { rangeDays?: unknown } | null | undefined;
    const rd = Number(body?.rangeDays);
    const rangeDays = rd === 7 || rd === 30 || rd === 90 ? rd : 30;

    const payload = await buildMerchantAnalytics({
      businessId: merchant.businessId,
      rangeDays,
    });
    void maybeEmitSmartAlerts({
      businessId: merchant.businessId,
      rangeDays,
    });
    void maybeEmitRetentionNudges(merchant.businessId);
    res.json(payload);
  } catch (e) {
    console.error("ANALYTICS ERROR:", e);
    res.status(500).json({ error: "analytics failed" });
  }
});

app.post("/merchant/intelligence/insights", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.analyticsView);
    if (!merchant) return;

    const body = req.body as { rangeDays?: unknown } | null | undefined;
    const rd = Number(body?.rangeDays);
    const rangeDays = rd === 7 || rd === 30 || rd === 90 ? rd : 30;

    const payload = await buildMerchantInsights({
      businessId: merchant.businessId,
      rangeDays,
    });
    res.json(payload);
  } catch (e) {
    console.error("POST /merchant/intelligence/insights:", e);
    res.status(500).json({ error: "insights failed" });
  }
});

app.get("/merchant/intelligence/growth", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.analyticsView);
    if (!merchant) return;

    const payload = await buildMerchantGrowth(merchant.businessId);
    res.json(payload);
  } catch (e) {
    console.error("GET /merchant/intelligence/growth:", e);
    res.status(500).json({ error: "growth failed" });
  }
});

app.post("/merchant/growth/dashboard", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.analyticsView);
    if (!merchant) return;

    const body = req.body as { rangeDays?: unknown } | null | undefined;
    const rd = Number(body?.rangeDays);
    const rangeDays = rd === 7 || rd === 30 || rd === 90 ? rd : 30;

    const payload = await buildMerchantGrowthDashboard({
      businessId: merchant.businessId,
      rangeDays,
    });
    void maybeEmitRetentionNudges(merchant.businessId);
    res.json(payload);
  } catch (e) {
    console.error("POST /merchant/growth/dashboard:", e);
    res.status(500).json({ error: "growth dashboard failed" });
  }
});

app.get("/api/storefront/recommendations", async (req: Request, res: Response) => {
  try {
    const businessId = await resolveCatalogBusinessId(req, res);
    if (businessId == null) return;

    const productIdRaw = req.query.productId;
    const productId =
      productIdRaw != null && String(productIdRaw).trim() !== ""
        ? Number(productIdRaw)
        : null;
    const limitRaw = Number(req.query.limit);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 24) : 8;

    const items = await getCoPurchaseRecommendations({
      businessId,
      productId:
        productId != null && Number.isInteger(productId) && productId > 0
          ? productId
          : null,
      limit,
    });
    res.json({ items });
  } catch (e) {
    console.error("GET /api/storefront/recommendations:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/storefront/events", async (req: Request, res: Response) => {
  try {
    const businessId = await resolveCatalogBusinessId(req, res);
    if (businessId == null) return;

    const body = req.body as {
      events?: Array<{
        eventType?: unknown;
        visitorKey?: unknown;
        userId?: unknown;
        productId?: unknown;
        meta?: unknown;
      }>;
    };
    const raw = Array.isArray(body?.events) ? body.events : [];
    const count = await ingestStorefrontEvents({
      businessId,
      events: raw.map((ev) => ({
        eventType: String(ev.eventType ?? ""),
        visitorKey: String(ev.visitorKey ?? ""),
        userId: typeof ev.userId === "number" ? ev.userId : null,
        productId: typeof ev.productId === "number" ? ev.productId : null,
        meta:
          ev.meta != null && typeof ev.meta === "object" && !Array.isArray(ev.meta)
            ? (ev.meta as Record<string, unknown>)
            : {},
      })),
    });
    res.json({ ok: true, ingested: count });
  } catch (e) {
    console.error("POST /api/storefront/events:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.get("/merchant/notifications", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res);
    if (!merchant) return;
    const limit = Number(req.query.limit);
    const out = await listMerchantNotifications({
      businessId: merchant.businessId,
      limit: Number.isFinite(limit) ? limit : 20,
    });
    res.json(out);
  } catch (e) {
    console.error("GET /merchant/notifications:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/merchant/notifications/read-all", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res);
    if (!merchant) return;
    await markMerchantNotificationsRead({ businessId: merchant.businessId });
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /merchant/notifications/read-all:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/merchant/notifications/:id/read", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res);
    if (!merchant) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await markMerchantNotificationsRead({
      businessId: merchant.businessId,
      notificationId: id,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /merchant/notifications/:id/read:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

function orderStatusRu(status: string): string {
  const map: Record<string, string> = {
    new: "Новый",
    NEW: "Новый",
    ACCEPTED: "Принят",
    PAID_PENDING: "Ожидает подтверждения оплаты",
    CONFIRMED: "Оплачен",
    SHIPPED: "Отправлен",
    DELIVERED: "Доставлен",
    CANCELLED: "Отменён",
    processing: "В обработке",
    shipped: "Отправлен",
    delivered: "Доставлен",
    cancelled: "Отменён",
  };
  return map[status] ?? map[status.toLowerCase()] ?? status;
}

// ================== GET PRODUCTS ==================
app.get("/products", async (req: Request, res: Response) => {
  try {
    const businessId = await resolveCatalogBusinessId(req, res);
    if (!businessId) return;
    const products = await prisma.product.findMany({
      where: { businessId },
      include: {
        category: true,
      },
    });

    res.json(products);
  } catch (error) {
    console.error("GET PRODUCTS ERROR:", error);
    res.status(500).json({ error: "Ошибка получения товаров" });
  }
});

app.get("/products/:id", async (req: Request, res: Response) => {
  try {
    const businessId = await resolveCatalogBusinessId(req, res);
    if (!businessId) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });
    if (!product) {
      return res.status(404).json({ error: "Товар не найден" });
    }
    if (product.businessId !== businessId) {
      return res.status(404).json({ error: "Товар не найден" });
    }
    res.json(product);
  } catch (error) {
    console.error("GET PRODUCT ERROR:", error);
    res.status(500).json({ error: "Ошибка получения товара" });
  }
});

async function fetchAdminOrdersPayload(businessId: number) {
  const rows = await prisma.order.findMany({
    where: { businessId },
    include: { buyerUser: true },
    orderBy: { id: "desc" },
  });
  return rows.map((o) => {
    const tracking = (o.tracking ?? "").trim() || null;
    const receiptUrl = (o.receiptUrl ?? "").trim() || null;
    const receiptType = (o.receiptType ?? "").trim() || null;
    const paymentMethod = (o.paymentMethod ?? "").trim() || "receipt";
    const address =
      typeof o.address === "string" && o.address.trim() !== ""
        ? o.address.trim()
        : null;
    const lat =
      o.lat != null && Number.isFinite(Number(o.lat)) ? Number(o.lat) : null;
    const lng =
      o.lng != null && Number.isFinite(Number(o.lng)) ? Number(o.lng) : null;
    const phone =
      typeof o.phone === "string" && o.phone.trim() !== ""
        ? o.phone.trim()
        : "—";
    return {
      id: o.id,
      orderNumber: o.orderNumber?.trim() || null,
      displayNumber: orderDisplayLabel(o),
      name:
        (o.buyerUser?.name && o.buyerUser.name.trim()) ||
        (o.name && o.name.trim()) ||
        "Гость",
      phone,
      status: o.status,
      statusText: orderStatusRu(o.status),
      total: o.total,
      tracking,
      receiptUrl,
      receiptType,
      paymentMethod,
      address,
      lat,
      lng,
      buyerTelegramId:
        o.buyerUser?.telegramId != null && String(o.buyerUser.telegramId).trim() !== ""
          ? String(o.buyerUser.telegramId)
          : null,
    };
  });
}

// ================== MY ORDERS (mini app, по Telegram userId) ==================
app.get("/orders/my", async (req: Request, res: Response) => {
  try {
    const telegramId = telegramIdFromRequest(req);
    if (!telegramId) {
      return res.status(400).json({ error: "Нужен userId (Telegram)" });
    }

    const businessId = await resolveCatalogBusinessId(req, res);
    if (!businessId) return;

    const orders = await prisma.order.findMany({
      where: {
        businessId,
        buyerUser: { telegramId },
      },
      orderBy: { id: "desc" },
      include: { items: true },
    });
    res.json(orders);
  } catch (e) {
    console.error("GET /orders/my:", e);
    res.status(500).json({ error: "Ошибка загрузки заказов" });
  }
});

attachSupportRoutes(app, {
  upload,
  telegramIdFromRequest,
  resolveCatalogBusinessId,
  requireMerchantStaff,
});

// ================== LIST ORDERS (admin, Prisma) ==================
app.get("/orders", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.ordersManage);
    if (!merchant) return;
    res.json(await fetchAdminOrdersPayload(merchant.businessId));
  } catch (e) {
    console.error("LIST ORDERS ERROR:", e);
    res.status(500).json({ error: "Ошибка загрузки заказов" });
  }
});

app.post("/orders/list", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.ordersManage);
    if (!merchant) return;
    res.json(await fetchAdminOrdersPayload(merchant.businessId));
  } catch (e) {
    console.error("LIST ORDERS ERROR:", e);
    res.status(500).json({ error: "Ошибка загрузки заказов" });
  }
});

/** Уведомление админу в Telegram о новом заказе из POST /orders (Prisma). */
async function notifyAdminNewOrderTelegram(input: {
  orderId: number;
  orderNumber: string | null;
  businessId: number;
  customerName: string;
  phone: string;
  total: number;
  itemCount: number;
}): Promise<void> {
  const chatId = getNotifyTargetChatId(input.businessId);
  if (chatId == null) {
    console.log(
      "TELEGRAM ORDER NOTIFY: пропуск (нет чата: задайте CHAT_ID или /start у бота)"
    );
    return;
  }

  const displayNum =
    input.orderNumber?.trim() ||
    orderDisplayLabel({ id: input.orderId, orderNumber: null });
  const message = formatNewOrderTelegramMessage({
    orderNumber: displayNum,
    customerName: input.customerName,
    phone: input.phone,
    total: input.total,
    itemCount: input.itemCount,
  });

  const adminUrl = await buildMerchantAdminOrdersWebAppUrl(input.businessId);
  const replyMarkup = adminMiniAppNotifyKeyboard(adminUrl);

  try {
    const tgBot = getBotForOwner(input.businessId) ?? bot;
    if (tgBot) {
      await tgBot.telegram.sendMessage(chatId, message, {
        reply_markup: replyMarkup,
      });
      console.log("TELEGRAM ORDER NOTIFY: ok", displayNum);
      return;
    }

    const token =
      process.env.BOT_TOKEN?.trim() ||
      process.env.BOT_TOKENS?.split(/[,;]+/).map((s) => s.trim()).filter(Boolean)[0];
    if (!token) {
      console.log("TELEGRAM ORDER NOTIFY: пропуск (нет BOT_TOKEN / BOT_TOKENS)");
      return;
    }

    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          reply_markup: replyMarkup,
        }),
      }
    );
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
    };
    if (!res.ok || json.ok === false) {
      console.error(
        "TELEGRAM ORDER NOTIFY: sendMessage failed",
        res.status,
        json
      );
    } else {
      console.log("TELEGRAM ORDER NOTIFY: ok", displayNum);
    }
  } catch (error) {
    console.error("TELEGRAM ORDER NOTIFY error:", error);
  }
}

// ================== CREATE ORDER ==================
app.post("/orders", async (req: Request, res: Response) => {
  try {
  const body = req.body;

  console.log("DATA:", body);

  if (!body.user || !body.items || body.total == null) {
    return res.status(400).json({ error: "Неверные данные заказа" });
  }

  const phoneRaw = String((body as { phone?: unknown }).phone ?? "").trim();
  if (phoneRaw.length > 13) {
    return res.status(400).json({ error: "Неверный номер телефона" });
  }
  if (!validateKgPhone(phoneRaw)) {
    return res.status(400).json({ error: "Неверный номер телефона" });
  }
  const customerPhoneValue = phoneRaw;

  const paymentMethod = "finik";
  const rawPaymentId = (body as { paymentId?: unknown }).paymentId;
  const paymentId =
    typeof rawPaymentId === "string" && rawPaymentId.trim() !== ""
      ? rawPaymentId.trim().slice(0, 512)
      : null;

  const userNameSanitized = cleanInput(
    (body as { user?: { name?: unknown } }).user?.name
  );
  const addressSanitized = cleanInput((body as { address?: unknown }).address);
  const orderAddress =
    addressSanitized !== "" ? addressSanitized.slice(0, 2000) : null;

  const rawLat = (body as { lat?: unknown }).lat;
  const rawLng = (body as { lng?: unknown }).lng;
  let orderLat: number | null = null;
  let orderLng: number | null = null;
  if (rawLat != null && rawLng != null) {
    const la = Number(rawLat);
    const lo = Number(rawLng);
    if (
      Number.isFinite(la) &&
      Number.isFinite(lo) &&
      la >= -90 &&
      la <= 90 &&
      lo >= -180 &&
      lo <= 180
    ) {
      orderLat = la;
      orderLng = lo;
    }
  }

  const rawItems = body.items as Array<{
    productId: number;
    name: string;
    size: string;
    color: string;
    options?: unknown;
    quantity: number;
    price: number;
  }>;

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return res.status(400).json({ error: "Корзина пуста" });
  }

  const items = rawItems.map((item) => ({
    ...item,
    name: cleanInput(item.name),
    size: cleanInput(item.size),
    color: cleanInput(item.color),
    options: item.options,
    quantity: Number(item.quantity),
    price: Number(item.price),
    productId: Number(item.productId),
  }));

  const probe = await prisma.product.findUnique({
    where: { id: items[0]!.productId },
    select: { businessId: true },
  });
  if (!probe) {
    return res.status(400).json({ error: "Товар не найден" });
  }
  const tenantBusinessId = probe.businessId;

  const biz = await prisma.business.findUnique({
    where: { id: tenantBusinessId },
  });
  const businessType = (biz as any)?.businessType;
  if (typeof businessType !== "string" || businessType.trim() === "") {
    return res.status(500).json({ error: "Магазин без businessType" });
  }

  const itemsValidated: Array<
    (typeof items)[number] & { optionsValidated: Record<string, unknown> }
  > = [];
  for (const it of items) {
    const mergedOptions =
      it.options != null && typeof it.options === "object" && !Array.isArray(it.options)
        ? (it.options as Record<string, unknown>)
        : {};
    const v = validateOrderOptionsForCheckout(businessType as any, mergedOptions);
    if (!v.ok) {
      return res.status(400).json({ error: v.error, details: v.details });
    }
    itemsValidated.push({ ...it, optionsValidated: v.value });
  }

  const hintedTenant = businessIdFromNonApiHint(req);
  if (hintedTenant != null && hintedTenant !== tenantBusinessId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const totalComputed = await computeOrderTotalFromBody(
    body,
    tenantBusinessId
  );
  if (!totalComputed.ok) {
    return res.status(400).json({ error: totalComputed.error });
  }
  const orderTotal = totalComputed.orderTotal;

  try {
    const { order, buyerUser } = await prisma.$transaction(async (tx) => {
      const telegramId = String(body.user.telegramId ?? "").trim();
      if (!telegramId) {
        throw new Error("BAD_TELEGRAM_ID");
      }
      const businessId = tenantBusinessId;
      const buyerUserInner = await upsertBuyerUser(
        tx,
        businessId,
        telegramId,
        userNameSanitized || null
      );

      const orderNameDisplay =
        (userNameSanitized && userNameSanitized.trim()) || "Гость";
      const addrFinal =
        orderAddress && orderAddress.trim() !== "" ? orderAddress : "—";

      for (const item of items) {
        const productId = Number(item.productId);
        const qty = Number(item.quantity);
        if (!productId || Number.isNaN(qty) || qty < 1) {
          throw new Error("INVALID_ITEM");
        }

        const p = await tx.product.findUnique({
          where: { id: productId },
          select: { businessId: true },
        });
        if (!p || p.businessId !== businessId) {
          throw new Error("CROSS_SHOP_CART");
        }
      }

      const orderNumber = await allocateHumanOrderNumber(tx, businessId);

      const order = await tx.order.create({
        data: {
          businessId,
          buyerUserId: buyerUserInner.id,
          orderNumber,
          name: orderNameDisplay,
          phone: customerPhoneValue,
          address: addrFinal,
          total: orderTotal,
          status: "NEW",
          lat: orderLat,
          lng: orderLng,
          paymentMethod,
          paymentId: paymentMethod === "finik" ? null : paymentId,
          items: {
            create: itemsValidated.map((item) => ({
              businessId,
              productId: Number(item.productId),
              name: item.name,
              size: String(item.size),
              color: String(item.color),
              options: item.optionsValidated,
              quantity: Number(item.quantity),
              price: Number(item.price),
            })) as any,
          },
        },
        include: {
          items: true,
        },
      });

      return { order, buyerUser: buyerUserInner };
    });

    console.log("ORDER CREATED:", order);

    let paymentUrl: string | null = null;
    let orderForResponse = order;

    if (paymentMethod === "finik") {
      const business = await prisma.business.findUnique({
        where: { id: order.businessId },
        select: { id: true, finikApiKey: true, finikSecret: true },
      });
      if (!business) {
        return res.status(500).json({ error: "Магазин не найден" });
      }
      const finik = await createFinikMerchantSession(business, {
        orderId: order.id,
        amount: order.total,
      });
      if (!finik.ok) {
        return res.status(502).json({ error: finik.error });
      }
      paymentUrl = finik.paymentUrl;
      orderForResponse = await prisma.order.update({
        where: { id: order.id },
        data: { paymentId: finik.paymentId },
        include: { items: true },
      });
    }

    const address =
      orderForResponse.address?.trim() ||
      (addressSanitized !== "" ? addressSanitized : "—");
    const displayName =
      buyerUser.name?.trim() || userNameSanitized || "Гость";
    const phone =
      orderForResponse.phone?.trim() || customerPhoneValue || "—";

    const orderItemsAny = (orderForResponse as any).items as Array<{ name: string; quantity: number }> | undefined;
    const itemCount = Array.isArray(orderItemsAny)
      ? orderItemsAny.reduce(
          (sum: number, i: { quantity?: number }) =>
            sum + Math.max(0, Number(i?.quantity ?? 0)),
          0,
        )
      : 0;
    void notifyAdminNewOrderTelegram({
      orderId: orderForResponse.id,
      orderNumber: orderForResponse.orderNumber,
      businessId: orderForResponse.businessId,
      customerName: displayName,
      phone,
      total: orderForResponse.total,
      itemCount: itemCount > 0 ? itemCount : 1,
    });

    void createMerchantNotification({
      businessId: orderForResponse.businessId,
      kind: "ORDER_NEW",
      title: `Новый заказ ${orderDisplayLabel(orderForResponse)}`,
      body: `${displayName} · ${orderForResponse.total} сом`,
      href: "#/admin/orders",
    });

    if (totalComputed.promoRaw) {
      try {
        await consumePromoDb(prisma, order.businessId, totalComputed.promoRaw);
      } catch (e) {
        console.error("consumePromo after /orders:", e);
      }
    }

    res.json({ ...orderForResponse, paymentUrl });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INVALID_ITEM") {
      return res.status(400).json({ error: "Неверные данные позиции в заказе" });
    }
    if (code === "BAD_TELEGRAM_ID") {
      return res.status(400).json({ error: "Нужен Telegram userId" });
    }
    if (code === "CROSS_SHOP_CART") {
      return res
        .status(400)
        .json({ error: "В корзине товары из разных магазинов" });
    }
    console.error("ORDER ERROR FULL:", error);
    res.status(500).json({ error: "Ошибка при создании заказа" });
  }
  } catch (e) {
    console.error("ORDERS POST ROUTE ERROR:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: "Server error" });
    }
  }
});

app.post(
  "/orders/:id/upload-receipt",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.ordersManage);
      if (!merchant) return;
      if (!isCloudinaryConfigured()) {
        return res.status(503).json({
          error:
            "Cloudinary не настроен (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)",
        });
      }
      const file = req.file;
      if (!file?.buffer?.length) {
        return res.status(400).json({ error: "No file" });
      }
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Неверный id" });
      }
      const mime = file.mimetype || "";
      const allowed =
        mime === "application/pdf" ||
        mime === "application/x-pdf" ||
        mime.startsWith("image/");
      if (!allowed) {
        return res
          .status(400)
          .json({ error: "Допустимы только изображение или PDF" });
      }

      const existing = await prisma.order.findUnique({ where: { id } });
      if (!existing || existing.businessId !== merchant.businessId) {
        return res.status(404).json({ error: "Заказ не найден" });
      }

      if (String(existing.paymentMethod ?? "").toLowerCase() === "finik") {
        return res
          .status(400)
          .json({ error: "Для оплаты Finik загрузка чека не используется" });
      }

      if (existing.receiptUrl != null && String(existing.receiptUrl).trim() !== "") {
        return res.status(400).json({ error: "Чек уже загружен" });
      }

      if (existing.status !== "ACCEPTED") {
        return res.status(400).json({ error: "Оплата недоступна" });
      }

      const { secureUrl, receiptType } = await uploadReceiptToCloudinary(
        file.buffer,
        mime
      );

      const receiptData = {
        receiptUrl: secureUrl,
        receiptType,
        status: "PAID_PENDING",
      };
      const order = await prisma.order.update({
        where: { id },
        data: receiptData as Prisma.OrderUpdateInput,
        include: { items: true, buyerUser: true },
      });

      res.json(order);
    } catch (e) {
      console.error("UPLOAD RECEIPT:", e);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

// ================== UPDATE PRODUCT ==================
app.put("/products/:id", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.catalogEdit);
    if (!merchant) return;
    const body = req.body as {
      name?: unknown;
      price?: unknown;
      image?: unknown;
      images?: unknown;
      description?: unknown;
      categoryId?: unknown;
      attributes?: unknown;
    };

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }

    const { name, price, image, images, description, categoryId, attributes } =
      body;

    if (
      name === undefined &&
      price === undefined &&
      image === undefined &&
      images === undefined &&
      description === undefined &&
      categoryId === undefined &&
      attributes === undefined
    ) {
      return res.status(400).json({ error: "Нет полей для обновления" });
    }

    const scalar: {
      name?: string;
      price?: number;
      image?: string;
      images?: string[];
      description?: string | null;
      categoryId?: number;
      attributes?: Record<string, unknown>;
    } = {};

    if (name !== undefined) scalar.name = String(name);
    if (price !== undefined) scalar.price = Number(price);
    if (categoryId !== undefined) {
      const normalizedCategoryId = Number(categoryId);
      if (!Number.isFinite(normalizedCategoryId)) {
        return res.status(400).json({ error: "Неверная категория" });
      }
      const category = await prisma.category.findUnique({
        where: { id: normalizedCategoryId },
        select: { id: true, businessId: true },
      });
      if (!category || category.businessId !== merchant.businessId) {
        return res.status(400).json({ error: "Неверная категория" });
      }
      scalar.categoryId = normalizedCategoryId;
    }
    if (images !== undefined) {
      const list = Array.isArray(images)
        ? images
            .filter((u) => u != null && String(u).trim() !== "")
            .map((u) => String(u).trim())
        : [];
      scalar.images = list;
      const firstImg = list[0];
      if (firstImg !== undefined) {
        scalar.image = firstImg;
      }
    }
    if (image !== undefined) {
      scalar.image = String(image);
      if (images === undefined) {
        scalar.images = [String(image)];
      }
    }
    if (description !== undefined) {
      scalar.description = description === null ? null : String(description);
    }
    if (attributes !== undefined) {
      const b2 = await prisma.business.findUnique({
        where: { id: merchant.businessId },
      });
      const businessType = (b2 as any)?.businessType;
      if (typeof businessType !== "string" || businessType.trim() === "") {
        return res.status(400).json({ error: "Магазин без businessType" });
      }
      const vAttr = validateProductAttributes(
        businessType as any,
        attributes,
      );
      if (!vAttr.ok) {
        return res
          .status(400)
          .json({ error: vAttr.error, details: vAttr.details });
      }
      scalar.attributes = vAttr.value;
    }

    const exists = await prisma.product.findUnique({ where: { id } });
    if (!exists || exists.businessId !== merchant.businessId) {
      return res.status(404).json({ error: "Товар не найден" });
    }

    const product = await prisma.product.update({
      where: { id },
      // Prisma UpdateInput is strict about relation scalars (categoryId) with exactOptionalPropertyTypes.
      data: scalar as any,
      include: { category: true },
    });

    res.json(product);
  } catch (e) {
    console.error("UPDATE PRODUCT ERROR:", e);
    res.status(500).json({ error: "Ошибка обновления товара" });
  }
});

// ================== DELETE PRODUCT ==================
app.delete("/products/:id", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.catalogEdit);
    if (!merchant) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }

    const exists = await prisma.product.findUnique({ where: { id } });
    if (!exists || exists.businessId !== merchant.businessId) {
      return res.status(404).json({ error: "Товар не найден" });
    }

    // Safe delete sync: remove cloudinary assets referenced by Product.imagesMeta.
    try {
      const ids = extractCloudinaryPublicIds((exists as any).imagesMeta);
      for (const pid of ids) {
        await safeDeleteCloudinaryAsset({
          businessId: merchant.businessId,
          publicId: pid,
          kindPrefix: "products",
        });
      }
    } catch (e) {
      console.error("product delete sync:", e);
    }

    await prisma.product.delete({ where: { id } });

    res.status(204).send();
  } catch (e) {
    console.error("DELETE PRODUCT ERROR:", e);
    res.status(500).json({ error: "Ошибка удаления товара" });
  }
});

/** Раздача Vite SPA с того же хоста, что и API (Render): иначе Mini App на API_URL видит только текст «Server is working». */
if (SPA_AVAILABLE) {
  app.use(express.static(FRONTEND_DIST, { index: false, maxAge: "1h" }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/telegram-webhook") ||
      req.path.startsWith("/webhook")
    ) {
      return next();
    }
    sendSpaIndexHtml(res, next);
  });
}

app.use(apiSafeErrorHandler);

// ================== GLOBAL PROCESS ERRORS ==================
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT ERROR:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED PROMISE:", reason);
});

function safePlainBotTokenForBootstrap(raw: string | null | undefined): string {
  try {
    return plainBotTokenFromStored(raw);
  } catch (e: unknown) {
    console.error("[bootstrapBots] token decrypt skip:", e);
    return "";
  }
}

async function bootstrapBots(): Promise<void> {
  const businesses = await prisma.business.findMany({
    where: { isActive: true, isBlocked: false },
    select: { id: true, botToken: true },
  });

  for (const b of businesses) {
    try {
      const token = safePlainBotTokenForBootstrap(b.botToken);
      if (token === "") continue;
      const out = await launchClientBot(b);
      if (out.ok) {
        console.log("Bot started:", b.id);
      } else {
        console.error("Bot start error:", b.id, out.error);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Bot start error:", b.id, msg);
    }
  }
}

// ================== START SERVER ==================
const PORT = process.env.PORT || 3000;

void (async () => {
  assertEnvironmentOrExit();
  try {
    await connectDatabase();
    console.log("DB connected ✅");
  } catch (e) {
    logPrismaError("connectDatabase()", e);
    console.error("DB connection failed — exit");
    process.exit(1);
  }

  app.listen(PORT, async () => {
    console.log(`Server running on ${PORT}`);

    if (publicApiBase && bots.length > 0) {
      for (let i = 0; i < bots.length; i++) {
        const url = `${publicApiBase}/telegram-webhook/${i}`;
        void telegramSetWebhookOnApi(bots[i]!.telegram, url).catch((err: unknown) =>
          console.error("Static bot setWebhook error:", i, err),
        );
      }
    } else if (bots.length > 0) {
      console.log(
        "API_URL not set — skipping setWebhook (set API_URL for production; path /telegram-webhook/{index})"
      );
    }
    try {
      await bootstrapBots();
      registerDynamicBotsGracefulShutdownOnce();
      console.log("[botManager] Dynamic store bots registered from database");
    } catch (e) {
      console.error("bootstrapBots:", e);
    }
    try {
      startSubscriptionMaintenanceScheduler();
    } catch (e) {
      console.error("startSubscriptionMaintenanceScheduler:", e);
    }
  });
})();