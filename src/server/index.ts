import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import {
  BusinessStaffRole,
  DeliveryMode,
  MembershipRole,
  OrderStatus as PrismaOrderStatus,
  Prisma,
} from "@prisma/client";
import {
  isCloudinaryConfigured,
  uploadImageToCloudinary,
  uploadReceiptToCloudinary,
} from "./cloudinary.js";
import {
  runRequireTelegramAuth,
  verifiedTelegramIdFromRequest,
} from "../middleware/verifiedTelegramAuth.js";
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
  savePlatformFinikForMerchant,
  updatePlatformStoreSettingsForMerchant,
  type PlatformStoreSettingsUpdateBody,
} from "./platformMerchantStoreSettings.js";
import {
  formatZodApiError,
  platformCheckWebhookBodySchema,
  platformDeleteMyBusinessBodySchema,
  platformMerchantBotRecoveryBodySchema,
  platformMerchantBotTokenBodySchema,
  platformRegisterRequestShape,
  platformSubscriptionPaymentBodySchema,
  platformSubscriptionPaymentCancelBodySchema,
  platformSubscriptionAutoRenewBodySchema,
  platformAdminExtendBodySchema,
  platformToggleBotBodySchema,
} from "./platformRouteBodySchemas.js";
import {
  buildMerchantBotRecoveryStatus,
  reconnectMerchantStoreBot,
} from "./merchantBotRecoveryService.js";
import { platformMerchantIsStoreOwner } from "./platformMerchantAccess.js";
import { applyOwnerBotTokenSelfService } from "./platformMerchantChangeService.js";
import { validateAndPersistPlatformRegistration } from "./platformRegisterRequest.js";
import { getMerchantRegistrationStatus } from "./registrationStatusService.js";
import {
  buildTemplateRegistryDescriptor,
  validateOrderOptionsForCheckout,
  validateProductAttributes,
} from "./templateValidation.js";
import {
  approveRegistrationRequestById,
  extendBusinessSubscriptionAdmin,
  listSubscriptionManualExtensionsAdmin,
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
import { toPublicProduct, findStockConsistencyIssues } from "../shared/productDto.js";
import {
  parseProductBulkPatch,
  parseProductListQuery,
  parseProductStatus,
  parseBulkProductIds,
  queryRequiresMerchantCatalogAccess,
} from "../shared/catalogTypes.js";
import {
  archiveProduct,
  bulkPatchProducts,
  duplicateProduct,
  listProducts,
  purgeProductPermanent,
  restoreProduct,
  isProductVisibleOnStorefront,
  type CatalogProductRow,
} from "./catalog/catalogProductService.js";
import {
  buildCategoryTree,
  reorderCategories,
  updateCategory,
} from "./catalog/categoryCatalogService.js";
import {
  API_ERR_BUSINESS_NOT_FOUND,
  API_ERR_FORBIDDEN,
  API_ERR_INVALID_BUSINESS_ID,
  API_ERR_INVALID_SLUG,
  API_ERR_MISSING_TENANT_QUERY,
  API_ERR_MISSING_TENANT_SHOP,
  API_ERR_NOT_FOUND,
  API_ERR_SERVER,
  API_ERR_STORE_UNAVAILABLE,
} from "../shared/apiClientMessages.js";
import { templateForBusinessType } from "../templates/index.js";
import { effectiveProductSchemaForBusiness } from "../shared/universalCommerce.js";
import {
  StorefrontConfigSchema,
  StorefrontStyleCatalogPatchSchema,
  StorefrontTextBrandingPatchSchema,
  StorefrontHeroSlidesPatchSchema,
  applyStorefrontStyleCatalogPatch,
  applyStorefrontTextBrandingPatch,
  applyStorefrontHeroSlidesPatch,
  defaultStorefrontConfig,
  resolveStorefrontConfig,
  type ResolvedStorefrontPayload,
} from "../storefront/schema.js";
import { validateUx } from "../ux/validators.js";
import {
  validateImageFile,
  validateReceiptFile,
  uploadTenantImage,
} from "../media/upload.js";
import { extractCloudinaryPublicIds, safeDeleteCloudinaryAsset } from "../media/delete.js";
import {
  auditProductImagesOnCreate,
  imagesMetaToJson,
  prepareProductImagesMeta,
  syncProductImagesOnUpdate,
} from "../media/productMediaService.js";
import { syncLogoReplaceCleanup } from "../media/themeMediaService.js";
import { syncQrReplaceCleanup } from "../media/themeMediaService.js";
import { scanTenantOrphans } from "../media/orphanScanner.js";
import { getTenantMediaStats } from "../media/storageAnalytics.js";
import { startMediaDestroyScheduler } from "../media/mediaDestroyScheduler.js";
import { invalidateStorefrontCache } from "./storefrontCache.js";
import { buildMerchantAnalytics } from "./merchantAnalyticsService.js";
import { buildMerchantWorkload } from "./merchantWorkloadService.js";
import {
  checkActionCooldown,
  touchActionCooldown,
  assertNotDuplicateOrder,
  buildFingerprintFromCart,
} from "./abuseGuardService.js";
import { releaseStaleUnpaidOrders } from "./staleOrderService.js";
import {
  extractVariantsFromProductPayload,
  loadStockRowsByProductIds,
  reserveOrderStock,
  syncProductStockFromVariants,
} from "./inventoryService.js";
import { priceCheckoutLines } from "./checkoutPricing.js";
import {
  buildCheckoutOrderItemRows,
  coerceCheckoutOrderTotal,
  coercePositiveInt,
  parseCheckoutDeliveryMode,
} from "./checkoutOrderWrite.js";
import {
  checkoutFailureResponse,
  logCheckoutStep,
  runCheckoutStep,
  surfaceCheckoutError,
} from "./checkoutErrorSurface.js";
import { probeCheckoutSchema, getCachedCheckoutSchemaProbe } from "./checkoutSchemaProbe.js";
import {
  logCommerceEvent,
  logCheckoutReject,
  logInventoryReserveFailed,
  logAuthReject,
  logInventoryMismatch,
} from "./structuredLog.js";
import { initializeOrderDelivery } from "./deliveryService.js";
import { resolveHybridCheckoutDelivery } from "./delivery/engine/hybridCheckoutDeliveryResolver.js";
import {
  CHECKOUT_DELIVERY_QUOTE_HTTP_STATUS,
  MERCHANT_OWNED_DELIVERY_PROVIDER,
} from "../shared/hybridDeliveryCheckout.js";
import {
  defaultStoreAvailabilitySettings,
  etaMidMinutes,
  parseStoreAvailabilitySettings,
  resolveDeliveryEtaForKm,
} from "../shared/storeAvailabilitySettings.js";
import { haversineDistanceKm } from "../shared/merchantDeliverySettings.js";
import { onOrderStatusChanged } from "./orderInventoryHooks.js";
import { attachStaffRoutes } from "./staffRoutes.js";
import {
  findBusinessStaff,
  findBusinessStaffByTelegramId,
  createOwnerStaffRow,
} from "./businessStaffAccess.js";
import { mergeProductAttributesWithVariants } from "./productAttributes.js";
import { buildMerchantInsights } from "./merchantInsightsService.js";
import { buildMerchantGrowth } from "./merchantGrowthService.js";
import { getCoPurchaseRecommendations } from "./recommendationsService.js";
import { maybeEmitSmartAlerts } from "./smartAlertsService.js";
import { assertEnvironmentOrExit, validateEnvironment } from "./envValidation.js";
import { buildPlatformOpsSummary } from "./platformOpsService.js";
import { healBusinessInventory, healAllBusinessesInventory } from "./inventoryHealService.js";
import { logVerbose } from "./serverDebug.js";
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
import { registerLifetimeOrderCreated } from "./merchantLifetimeAnalyticsService.js";
import {
  buildMerchantCustomerList,
  buildMerchantCustomerDetail,
  buildMerchantCustomerDashboard,
  buildMerchantCustomerInsights,
} from "./merchantCustomerService.js";
import {
  listMerchantPromotions,
  createMerchantPromotion,
  setMerchantPromotionActive,
  deleteMerchantPromotion,
  listMerchantCampaigns,
  createMerchantCampaign,
  setMerchantCampaignState,
  deleteMerchantCampaign,
  buildMarketingDashboard,
} from "./merchantMarketingService.js";
import {
  buildMerchantLoyalty,
  saveLoyaltyProgram,
} from "./merchantLoyaltyService.js";
import {
  changeMerchantSlug,
  checkSlugAvailability,
  resolveSlugOrAlias,
} from "./merchantSlugService.js";
import {
  extractWebProfile,
  mergeWebProfileIntoMerchantConfig,
  normalizeWebProfile,
} from "../shared/storefrontWebProfile.js";
import {
  isMetaInjectablePath,
  renderSpaHtmlWithMeta,
} from "./storefrontHtmlMeta.js";
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
import { buildUniversalMigrationReport } from "./migrations/universalMigrationReport.js";
import { runUniversalHybridMigration } from "./migrations/universalMigrationRunner.js";
import { computeRolloutSafetyStatus } from "./migrations/rolloutSafety.js";
import { buildTemplateMigrationRiskSnapshot } from "./migrations/riskControls.js";
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
  createPromoDb,
  deletePromoByCodeDb,
  listPromosFromDb,
  promoTrackingValue,
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
  blocksManualFinikPaymentConfirm,
  mountFinikWebhookRoutes,
  mountFinikSettingsRoutes,
  publicApiOrigin,
  syncFinikOrderPayment,
} from "./finikMerchant.js";
import { createStorefrontFinikCheckoutSession } from "./finik/createStorefrontFinikCheckoutSession.js";
import {
  FINIK_LEGACY_HTTP_UNAVAILABLE_ERROR,
  MERCHANT_FINIK_CHECKOUT_UNAVAILABLE,
  canCreateFinikPayment,
  isFinikCredentialsReady,
  isMerchantStorefrontFinikCheckoutAllowed,
} from "../shared/finikReady.js";
import {
  mountSubscriptionFinikPaymentRoutes,
  createSubscriptionFinikPaymentSession,
} from "./subscriptionFinikPayments.js";
import {
  buildMerchantSubscriptionPanel,
  cancelPendingPlatformSubscriptionPayment,
  createPlatformSubscriptionPaymentSession,
  listSubscriptionHistoryForMerchant,
  setMerchantAutoRenew,
} from "./platformSubscriptionBilling.js";
import { relayDynamicStoreWebhook as relayDynamicTenantStoreWebhook } from "./storeTelegramWebhookRelay.js";
import {
  isHexWebhookSlug,
  legacyNumericWebhookPathEnabled,
  telegramSetWebhookOnApi,
  telegramWebhookGate,
} from "./telegramWebhookSecurity.js";
import { startSubscriptionMaintenanceScheduler } from "./subscriptionMaintenance.js";
import { startStaleOrderCleanupScheduler } from "./staleOrderScheduler.js";
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
import {
  apiLimiter,
  strictLimiter,
  ordersLimiter,
  webhooksLimiter,
  supportLimiter,
  merchantMutationLimiter,
  telemetryLimiter,
} from "../middleware/apiRateLimits.js";
import { corsMiddleware } from "../middleware/security/corsPolicy.js";
import { securityHeadersMiddleware } from "../middleware/security/securityHeaders.js";
import { requestTimeoutMiddleware } from "../middleware/security/requestTimeout.js";
import { safeErrorEnvelopeMiddleware } from "../middleware/security/safeErrorEnvelope.js";
import { resolveTenantHintFromRequest } from "./resolveTenantHint.js";
import { assertBusinessScope } from "./businessScope.js";
import { routeRequiresMerchantMutationLimiter } from "../middleware/privilegedRoutes.js";
import { correlationIdMiddleware } from "../middleware/correlationId.js";
import { finikWebhookRawBody } from "../middleware/finikWebhookBody.js";
import { jsonBodyLimits } from "../middleware/jsonBodyLimits.js";
import { requireNonEmptyJsonBody } from "../middleware/requireNonEmptyJsonBody.js";
import { requireTelegramAuth } from "../middleware/requireTelegramAuth.js";
import { verifiedTelegramGate } from "../middleware/privilegedRoutes.js";
import { businessSubscriptionGateSelect } from "./subscriptionAccess.js";
import { rejectUnlessCanAcceptCustomerOrders } from "./subscriptionCustomerGate.js";
import { syncBusinessSubscriptionActivationState } from "./saasBillingService.js";
import { attachSupportRoutes } from "./supportRoutes.js";
import { attachDiningTableRoutes } from "./diningTableRoutes.js";
import { attachTableReservationRoutes } from "./tableReservationRoutes.js";
import { attachWaitlistRoutes } from "./waitlistRoutes.js";
import { startTableReservationScheduler } from "./tableReservationScheduler.js";
import { resolveCheckoutReservationId, markReservationPreorderPaymentPending } from "./tableReservationPreorder.js";
import { attachVenueOperationsRoutes } from "./venueOperationsRoutes.js";
import { attachDeliveryOffersRoutes } from "./delivery/deliveryOffersRoute.js";
import { attachDeliveryCalculateRoutes } from "./delivery/deliveryCalculateRoute.js";
import { attachDeliveryCheckoutQuoteRoutes } from "./delivery/deliveryCheckoutQuoteRoute.js";
import { attachDeliveryYandexWebhookRoutes } from "./delivery/deliveryYandexWebhookRoute.js";
import { attachDeliveryTrackingRoutes } from "./delivery/deliveryTrackingRoute.js";
import { attachDeliveryHealthRoutes } from "./delivery/deliveryHealthRoute.js";
import { attachDeliveryMerchantDashboardRoutes } from "./delivery/deliveryMerchantDashboardRoute.js";
import { attachDeliveryOperationsRoutes } from "./delivery/operations/deliveryOperationsRoutes.js";
import { attachDeliveryEngineRoutes } from "./delivery/engine/deliveryEngineRoutes.js";
import "./delivery/engine/deliveryEngineBootstrap.js";
import { startDeliveryRecoveryScheduler } from "./delivery/deliveryRecoveryScheduler.js";

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
if (process.env.NODE_ENV !== "production") {
  console.log("CHAT ID env:", process.env.CHAT_ID ?? "(empty)");
}

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

app.use(corsMiddleware);
app.use(securityHeadersMiddleware);
app.use(safeErrorEnvelopeMiddleware);
app.use(requestTimeoutMiddleware);
app.use(correlationIdMiddleware);
app.use(finikWebhookRawBody);
app.use(jsonBodyLimits);
app.use((req, res, next) => {
  void verifiedTelegramGate(req, res, next);
});
app.use((req, res, next) => {
  if (routeRequiresMerchantMutationLimiter(req)) {
    merchantMutationLimiter(req, res, next);
    return;
  }
  next();
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.get("/ready", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const env = validateEnvironment();
    const checkoutSchema = await probeCheckoutSchema(prisma);
    res.json({
      ok: true,
      db: true,
      ts: new Date().toISOString(),
      version: process.env.npm_package_version ?? "1.0.0",
      commit:
        typeof process.env.RENDER_GIT_COMMIT === "string"
          ? process.env.RENDER_GIT_COMMIT.slice(0, 7)
          : null,
      envOk: env.ok,
      envWarningCount: env.warnings.length,
      checkoutSchemaOk: checkoutSchema.ok,
      ...(checkoutSchema.missing.length > 0
        ? { checkoutSchemaMissing: checkoutSchema.missing }
        : {}),
    });
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
    logVerbose("INCOMING:", req.method, req.originalUrl ?? req.url);
  }
  next();
});
app.use("/api/", apiLimiter);
app.use("/api/platform/subscription-finik-webhook", webhooksLimiter);
app.use("/api/delivery/providers/yandex/webhook", webhooksLimiter);
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
    const isProd = process.env.NODE_ENV === "production";
    res.json({
      telegramId: isProd ? "[redacted]" : telegramId,
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
      res.status(400).json({ error: API_ERR_INVALID_BUSINESS_ID });
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
      res.status(404).json({ error: API_ERR_NOT_FOUND });
      return;
    }
    if (
      rejectUnlessCanAcceptCustomerOrders(res, row)
    ) {
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
    res.status(500).json({ error: API_ERR_SERVER });
  }
});

/** Платформа Mini App: user id только из подписанного initData (`requireTelegramAuth`). */
function platformTelegramIdFromWebApp(req: Request): string | null {
  const id = req.platformTelegramId;
  return typeof id === "string" && /^\d+$/.test(id) ? id : null;
}

function operatorForbidden(res: Response, code = "operator_forbidden"): void {
  res.status(403).json({ error: API_ERR_FORBIDDEN, code });
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

async function tryOperatorUnlockSilent(
  req: Request,
): Promise<{ telegramId: string } | null> {
  const telegramId = platformTelegramIdFromWebApp(req);
  if (!telegramId) return null;
  if (!isPlatformOperatorTelegramId(telegramId)) return null;
  const token = operatorSessionTokenFromReq(req);
  if (!token) return null;
  const valid = await validateOperatorSession({
    operatorTelegramId: telegramId,
    token,
  });
  if (!valid.ok) return null;
  return { telegramId };
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

app.get("/api/platform/subscription", async (req: Request, res: Response) => {
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
    const out = await buildMerchantSubscriptionPanel({
      telegramId,
      businessId: bid,
    });
    if (!out.ok) {
      res.status(out.statusCode).json({ error: out.error });
      return;
    }
    res.json(out.panel);
  } catch (e) {
    console.error("GET /api/platform/subscription:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

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
      const { businessId, plan, planCode } = parsed.data;
      const out = await createPlatformSubscriptionPaymentSession({
        telegramId,
        businessId,
        ...(planCode != null ? { planCode } : {}),
        ...(plan != null ? { plan } : {}),
      });
      if (!out.ok) {
        res.status(out.statusCode).json({ error: out.error });
        return;
      }
      res.json({
        paymentUrl: out.paymentUrl,
        subscriptionPaymentId: out.subscriptionPaymentId,
        planCode: out.planCode,
        planDays: out.planDays,
        accessDaysGranted: out.accessDaysGranted,
        amountSom: out.amountSom,
      });
    } catch (e) {
      console.error("POST /api/platform/subscription-payment/create:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },
);

app.post(
  "/api/platform/subscription-payment/cancel",
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
      const parsed = platformSubscriptionPaymentCancelBodySchema.safeParse(
        req.body,
      );
      if (!parsed.success) {
        res.status(400).json({ error: formatZodApiError(parsed.error) });
        return;
      }
      const out = await cancelPendingPlatformSubscriptionPayment({
        telegramId,
        businessId: parsed.data.businessId,
      });
      if (!out.ok) {
        res.status(out.statusCode).json({ error: out.error });
        return;
      }
      res.json({ success: true });
    } catch (e) {
      console.error("POST /api/platform/subscription-payment/cancel:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },
);

app.get("/api/platform/subscription/payments", async (req: Request, res: Response) => {
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
    const out = await listSubscriptionHistoryForMerchant({
      telegramId,
      businessId: bid,
    });
    if (!out.ok) {
      res.status(out.statusCode).json({ error: out.error });
      return;
    }
    res.json({ entries: out.entries, payments: out.entries });
  } catch (e) {
    console.error("GET /api/platform/subscription/payments:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.patch(
  "/api/platform/subscription/auto-renew",
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
      const parsed = platformSubscriptionAutoRenewBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: formatZodApiError(parsed.error) });
        return;
      }
      const out = await setMerchantAutoRenew({
        telegramId,
        businessId: parsed.data.businessId,
        enabled: parsed.data.enabled,
      });
      if (!out.ok) {
        res.status(out.statusCode).json({ error: out.error });
        return;
      }
      res.json({ ok: true, autoRenewEnabled: out.autoRenewEnabled });
    } catch (e) {
      console.error("PATCH /api/platform/subscription/auto-renew:", e);
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
      finikAccountId: raw.finikAccountId,
      newBotToken: raw.newBotToken,
      merchantConfig: raw.merchantConfig,
      addressLine: raw.addressLine,
      city: raw.city,
      latitude: raw.latitude,
      longitude: raw.longitude,
      deliverySettings: raw.deliverySettings,
      storeAvailabilitySettings: raw.storeAvailabilitySettings,
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
    const reqBody = req.body as {
      businessId?: unknown;
      finikApiKey?: unknown;
      finikAccountId?: unknown;
      finikSecret?: unknown;
    };
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
    const out = await savePlatformFinikForMerchant({
      telegramId,
      businessId,
      finikApiKey: reqBody.finikApiKey,
      finikAccountId: reqBody.finikAccountId,
      finikSecret: reqBody.finikSecret,
    });
    if (!out.ok) {
      res.status(out.statusCode).json({ error: out.error });
      return;
    }
    res.json({
      ok: true,
      finikConfigured: out.finikConfigured,
      finikReady: out.finikReady,
      finikHasApiKey: out.finikHasApiKey,
      finikHasAccountId: out.finikHasAccountId,
      finikLegacyHttpReady: out.finikLegacyHttpReady,
      finikHasSecret: out.finikHasSecret,
      finikWebhookUrl: out.finikWebhookUrl,
    });
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
      finikAccountId: shaped.data.finikAccountId,
      businessType: shaped.data.businessType,
      ownerUsername: shaped.data.ownerUsername,
      addressLine: shaped.data.addressLine,
      city: shaped.data.city,
      latitude: shaped.data.latitude,
      longitude: shaped.data.longitude,
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
      select: { businessType: true, merchantConfig: true },
    });
    const bt = (b as any)?.businessType;
    if (typeof bt !== "string" || bt.trim() === "") {
      return res.status(400).json({ error: "Магазин без businessType" });
    }
    const merchantConfig =
      (b as any)?.merchantConfig != null &&
      typeof (b as any).merchantConfig === "object" &&
      !Array.isArray((b as any).merchantConfig)
        ? ((b as any).merchantConfig as Record<string, unknown>)
        : {};
    const tpl = templateForBusinessType(bt as any);
    const fullProductSchema = tpl.productSchema ?? {};
    res.json({
      businessType: bt,
      templateVersion: tpl.templateVersion ?? 1,
      templateDescriptor: buildTemplateRegistryDescriptor(bt as any),
      productSchema: effectiveProductSchemaForBusiness(
        bt,
        fullProductSchema as any,
        merchantConfig,
      ),
      merchantSettingsSchema: tpl.merchantSettingsSchema ?? {},
      orderOptionsSchema: tpl.orderOptionsSchema ?? {},
      merchantConfig,
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
      res.status(400).json({ error: API_ERR_INVALID_SLUG });
      return;
    }
    let b = await prisma.business.findFirst({
      where: {
        slug: { equals: slug, mode: "insensitive" },
      } as any,
      select: businessSubscriptionGateSelect as any,
    });
    if (!b) {
      // Phase 17: resolve historical slug aliases so old links keep working.
      const aliasBusinessId = await resolveSlugOrAlias(slug);
      if (aliasBusinessId != null) {
        b = await prisma.business.findUnique({
          where: { id: aliasBusinessId },
          select: businessSubscriptionGateSelect as any,
        });
      }
    }
    if (!b) {
      res.status(404).json({ error: "Store not found" });
      return;
    }
    if (rejectUnlessCanAcceptCustomerOrders(res, b as any)) return;
    await sendStorefrontPublicPayload(res, (b as any).id);
  } catch (e) {
    console.error("GET /api/storefront/by-slug/:slug:", e);
    res.status(500).json({ error: API_ERR_SERVER });
  }
});

app.get("/api/storefront/:businessId", async (req: Request, res: Response) => {
  try {
    const businessId = Number(req.params.businessId);
    await sendStorefrontPublicPayload(res, businessId);
  } catch (e) {
    console.error("GET /api/storefront/:businessId:", e);
    res.status(500).json({ error: API_ERR_SERVER });
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
    if (!b) return res.status(404).json({ error: API_ERR_BUSINESS_NOT_FOUND });

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
    res.status(500).json({ error: API_ERR_SERVER });
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
    res.status(500).json({ error: API_ERR_SERVER });
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
    if (!b) return res.status(404).json({ error: API_ERR_BUSINESS_NOT_FOUND });

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
    res.status(500).json({ error: API_ERR_SERVER });
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
    res.status(500).json({ error: API_ERR_SERVER });
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
    res.status(500).json({ error: API_ERR_SERVER });
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
    res.status(500).json({ error: API_ERR_SERVER });
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
        return res.status(404).json({ error: API_ERR_NOT_FOUND });
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
      res.status(500).json({ error: API_ERR_SERVER });
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
    if (!b) return res.status(404).json({ error: API_ERR_BUSINESS_NOT_FOUND });
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
    res.status(500).json({ error: API_ERR_SERVER });
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
    res.status(500).json({ error: API_ERR_SERVER });
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
      res.status(404).json({ error: API_ERR_BUSINESS_NOT_FOUND });
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
    res.status(500).json({ error: API_ERR_SERVER });
  }
});

app.put("/api/merchant/storefront-text-branding-patch", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.designEdit);
    if (!merchant) return;

    const parsedPatch = StorefrontTextBrandingPatchSchema.safeParse(req.body);
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
      res.status(404).json({ error: API_ERR_BUSINESS_NOT_FOUND });
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

    const nextText = applyStorefrontTextBrandingPatch(
      cfg.storefrontTextConfig ?? {},
      parsedPatch.data,
    );
    const nextCfg = StorefrontConfigSchema.parse({
      ...cfg,
      storefrontTextConfig: nextText,
    });

    const mergeDraftTextWithPublished = (draftRaw: unknown) => {
      const d = StorefrontConfigSchema.safeParse(draftRaw ?? {});
      const draftBase = d.success ? d.data : defaultStorefrontConfig();
      return StorefrontConfigSchema.parse({
        ...draftBase,
        storefrontTextConfig: nextCfg.storefrontTextConfig,
      });
    };

    if (sf) {
      const draftMerged = mergeDraftTextWithPublished((sf as any).draftConfig);
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
    console.error("PUT /api/merchant/storefront-text-branding-patch:", e);
    res.status(500).json({ error: API_ERR_SERVER });
  }
});

app.put("/api/merchant/storefront-hero-slides-patch", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.designEdit);
    if (!merchant) return;

    const parsedPatch = StorefrontHeroSlidesPatchSchema.safeParse(req.body);
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
      res.status(404).json({ error: API_ERR_BUSINESS_NOT_FOUND });
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

    const nextCfg = applyStorefrontHeroSlidesPatch(cfg, parsedPatch.data);

    const mergeDraftHeroWithPublished = (draftRaw: unknown) => {
      const d = StorefrontConfigSchema.safeParse(draftRaw ?? {});
      const draftBase = d.success ? d.data : defaultStorefrontConfig();
      return StorefrontConfigSchema.parse({
        ...draftBase,
        sections: nextCfg.sections,
      });
    };

    if (sf) {
      const draftMerged = mergeDraftHeroWithPublished((sf as any).draftConfig);
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
    console.error("PUT /api/merchant/storefront-hero-slides-patch:", e);
    res.status(500).json({ error: API_ERR_SERVER });
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

app.get("/api/platform/admin/ops-summary", async (req: Request, res: Response) => {
  try {
    const unlocked = await requireOperatorUnlock(req, res);
    if (!unlocked) return;
    const summary = await buildPlatformOpsSummary();
    res.json(summary);
  } catch (e) {
    console.error("GET /api/platform/admin/ops-summary:", e);
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
    const unlocked = await requireOperatorRecentReauth(req, res);
    if (!unlocked) return;
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
    const { logOperatorAction } = await import("./structuredLog.js");
    logOperatorAction({
      action: "block_business",
      operatorTelegramId: unlocked.telegramId,
      businessId,
    });
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

app.get(
  "/api/platform/admin/businesses/:businessId/media/orphans",
  async (req: Request, res: Response) => {
    try {
      const unlocked = await requireOperatorUnlock(req, res);
      if (!unlocked) return;
      const businessId = Number(req.params.businessId);
      if (!Number.isFinite(businessId) || businessId <= 0) {
        return res.status(400).json({ error: "Неверный businessId" });
      }
      const result = await scanTenantOrphans(prisma, businessId);
      res.json({ ...result, dryRun: true });
    } catch (e) {
      console.error("GET platform media orphans:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },
);

app.get(
  "/api/platform/admin/businesses/:businessId/media/stats",
  async (req: Request, res: Response) => {
    try {
      const unlocked = await requireOperatorUnlock(req, res);
      if (!unlocked) return;
      const businessId = Number(req.params.businessId);
      if (!Number.isFinite(businessId) || businessId <= 0) {
        return res.status(400).json({ error: "Неверный businessId" });
      }
      const stats = await getTenantMediaStats(prisma, businessId);
      res.json(stats);
    } catch (e) {
      console.error("GET platform media stats:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },
);

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
    const unlocked = await requireOperatorRecentReauth(req, res);
    if (!unlocked) return;
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
    const { logOperatorAction } = await import("./structuredLog.js");
    logOperatorAction({
      action: "disable_business",
      operatorTelegramId: unlocked.telegramId,
      businessId,
    });
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
    const unlocked = await requireOperatorRecentReauth(req, res);
    if (!unlocked) return;
    const parsed = platformAdminExtendBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: formatZodApiError(parsed.error) });
      return;
    }
    const extendToDate =
      parsed.data.extendToDate != null
        ? new Date(parsed.data.extendToDate)
        : undefined;
    const out = await extendBusinessSubscriptionAdmin({
      businessId: parsed.data.businessId,
      operatorTelegramId: unlocked.telegramId,
      ...(parsed.data.days != null ? { days: parsed.data.days } : {}),
      ...(extendToDate != null ? { extendToDate } : {}),
    });
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

app.get(
  "/api/platform/admin/subscription-extensions",
  async (req: Request, res: Response) => {
    try {
      if (!(await requireOperatorRecentReauth(req, res))) return;
      const bid = Number((req.query as { businessId?: string }).businessId);
      if (!Number.isInteger(bid) || bid <= 0) {
        res.status(400).json({ error: "Нужен query businessId" });
        return;
      }
      const out = await listSubscriptionManualExtensionsAdmin(bid);
      if (!out.ok) {
        res.status(out.statusCode).json({ error: out.message });
        return;
      }
      res.json({ extensions: out.rows });
    } catch (e) {
      console.error("GET /api/platform/admin/subscription-extensions:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },
);

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
    const { logOperatorAction } = await import("./structuredLog.js");
    logOperatorAction({
      action: "purge_business",
      operatorTelegramId: unlocked.telegramId,
      businessId,
    });
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
      res.status(404).json({ error: API_ERR_BUSINESS_NOT_FOUND });
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

app.get(
  "/api/platform/admin/universal-migration-report",
  async (req: Request, res: Response) => {
    try {
      if (!(await requireOperatorUnlock(req, res))) return;
      const report = await buildUniversalMigrationReport();
      res.json({ ok: true, ...report });
    } catch (e) {
      console.error(
        "GET /api/platform/admin/universal-migration-report:",
        e,
      );
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },
);

app.post(
  "/api/platform/admin/universal-migration/run",
  async (req: Request, res: Response) => {
    try {
      if (!(await requireOperatorRecentReauth(req, res))) return;
      const dryRun = (req.body as { dryRun?: unknown }).dryRun !== false;
      const limitRaw = Number((req.body as { limit?: unknown }).limit);
      const limit = Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : undefined;
      const result = await runUniversalHybridMigration(
        limit == null ? { dryRun } : { dryRun, limit },
      );
      res.json({ ok: true, ...result });
    } catch (e) {
      console.error("POST /api/platform/admin/universal-migration/run:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },
);

app.get("/api/platform/admin/template-rollout-safety", async (req: Request, res: Response) => {
  try {
    if (!(await requireOperatorUnlock(req, res))) return;
    const status = await computeRolloutSafetyStatus();
    res.json({ ok: true, ...status });
  } catch (e) {
    console.error("GET /api/platform/admin/template-rollout-safety:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.get("/api/platform/admin/template-risk-controls", async (req: Request, res: Response) => {
  try {
    if (!(await requireOperatorUnlock(req, res))) return;
    const snapshot = await buildTemplateMigrationRiskSnapshot();
    res.json({ ok: true, ...snapshot });
  } catch (e) {
    console.error("GET /api/platform/admin/template-risk-controls:", e);
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
    if (!b) return res.status(404).json({ error: API_ERR_BUSINESS_NOT_FOUND });
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
    if (!b) return res.status(404).json({ error: API_ERR_BUSINESS_NOT_FOUND });
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
    if (!b) return res.status(404).json({ error: API_ERR_BUSINESS_NOT_FOUND });
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
      res.status(400).json({ error: API_ERR_INVALID_BUSINESS_ID });
      return;
    }
    if (typeof req.businessId !== "number" || req.businessId !== bid) {
      res.status(403).json({
        error: "Укажите тот же магазин в query ?shop=",
      });
      return;
    }
    const staff = req.tenantStaff;
    if (
      !staff ||
      (staff.role !== BusinessStaffRole.OWNER &&
        staff.role !== BusinessStaffRole.ADMIN &&
        staff.role !== BusinessStaffRole.MANAGER)
    ) {
      res.status(403).json({ error: "Нет доступа к настройкам магазина" });
      return;
    }

    const business = await prisma.business.findUnique({
      where: { id: bid },
      select: { themeConfig: true, templateId: true },
    });
    if (!business) {
      res.status(404).json({ error: API_ERR_NOT_FOUND });
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
      patch !== null &&
      typeof patch === "object" &&
      ("logoUrl" in patch || "logoPublicId" in patch);

    const patchLogoPublicId =
      patch != null && typeof patch === "object" && !Array.isArray(patch)
        ? (patch as { logoPublicId?: unknown }).logoPublicId
        : undefined;
    const nextLogoPublicId =
      patchLogoPublicId === null || patchLogoPublicId === ""
        ? null
        : typeof patchLogoPublicId === "string"
          ? patchLogoPublicId.trim() || null
          : result.merged.logoPublicId;

    if (patchTouchesLogo) {
      await syncLogoReplaceCleanup({
        prisma,
        businessId: bid,
        prevThemeConfig: business.themeConfig,
        nextLogoUrl: result.merged.logoUrl,
        nextLogoPublicId,
        actor: { actorType: "merchant", actorUserId: staff.id },
      });
    }

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
    res.status(500).json({ error: API_ERR_SERVER });
  }
});

app.put("/api/business/template", async (req: Request, res: Response) => {
  try {
    if (typeof req.businessId !== "number") {
      res.status(400).json({
        error: API_ERR_MISSING_TENANT_QUERY,
      });
      return;
    }
    const bid = req.businessId;
    const staff = req.tenantStaff;
    if (
      !staff ||
      (staff.role !== BusinessStaffRole.OWNER &&
        staff.role !== BusinessStaffRole.ADMIN &&
        staff.role !== BusinessStaffRole.MANAGER)
    ) {
      res.status(403).json({ error: "Нет доступа к настройкам магазина" });
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
      res.status(404).json({ error: API_ERR_NOT_FOUND });
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
    res.status(500).json({ error: API_ERR_SERVER });
  }
});

app.get("/api/me", (req: Request, res: Response) => {
  try {
    if (typeof req.businessId !== "number" || req.tenantBusiness == null) {
      res.status(400).json({
        error: API_ERR_MISSING_TENANT_QUERY,
      });
      return;
    }
    const staff = req.tenantStaff;
    const role = staff?.role ?? "CLIENT";
    const permissions = staff
      ? effectiveMerchantPermissions(staff.role, staff.permissions ?? [])
      : [];
    res.json({
      role,
      permissions,
      businessId: req.businessId,
      businessName: req.tenantBusiness.name ?? null,
      displayName: req.tenantUser?.name ?? null,
      username: req.tenantUser?.telegramUsername
        ? `@${String(req.tenantUser.telegramUsername).replace(/^@+/, "")}`
        : null,
      photoUrl: req.tenantUser?.photoUrl ?? null,
    });
  } catch (e) {
    console.error("GET /api/me:", e);
    res.status(500).json({ error: API_ERR_SERVER });
  }
});

/** @deprecated Use GET /api/staff — returns staff-only rows for backward compatibility. */
app.get("/api/memberships", async (req: Request, res: Response) => {
  try {
    if (typeof req.businessId !== "number") {
      res.status(400).json({ error: API_ERR_MISSING_TENANT_SHOP });
      return;
    }
    const ownerCtx = await requireStoreOwnerForApi(req, res, req.businessId);
    if (!ownerCtx) return;
    const { listStaffPublicRows } = await import("./businessStaffService.js");
    res.json(await listStaffPublicRows(req.businessId));
  } catch (e) {
    console.error("GET /api/memberships:", e);
    res.status(500).json({ error: API_ERR_SERVER });
  }
});

/** Telegram user id — verified initData only (production); legacy dev fallback. */
function telegramIdFromRequest(req: Request): string | null {
  return verifiedTelegramIdFromRequest(req);
}

const PUBLIC_BUSINESS_PARSE_ERROR = API_ERR_INVALID_BUSINESS_ID;
const PUBLIC_BUSINESS_MISSING_ERROR = API_ERR_NOT_FOUND;
const PUBLIC_BUSINESS_UNAVAILABLE_ERROR = API_ERR_STORE_UNAVAILABLE;

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
  return resolveTenantHintFromRequest(req);
}

type MerchantStaffContext = {
  businessId: number;
  staffId: number;
  role: BusinessStaffRole;
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

  const staff = await findBusinessStaff(businessId, requesterUser.id);
  if (!staff || staff.role !== BusinessStaffRole.OWNER) {
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
    const { logAuthReject } = await import("./structuredLog.js");
    logAuthReject({
      path: req.path ?? req.url,
      reason: "merchant_staff_missing_telegram_id",
      ...(req.ip ? { ip: req.ip } : {}),
    });
    res.status(401).json({
      error: "Требуется авторизация Telegram Mini App (x-telegram-init-data)",
    });
    return null;
  }
  if (businessId == null) {
    res.status(400).json({
      error:
        "Укажите магазин: query shop=<businessId>, заголовок x-business-id или body.businessId",
    });
    return null;
  }

  const staffRecord = await findBusinessStaffByTelegramId(businessId, telegramId);

  if (!staffRecord) {
    const { logTenantAccessDenied } = await import("./structuredLog.js");
    logTenantAccessDenied({
      path: req.path ?? req.url,
      businessId,
      reason: "no_staff_membership",
    });
    res.status(403).json({ error: "Нет доступа к этому магазину" });
    return null;
  }

  const effectivePermissions = effectiveMerchantPermissions(
    staffRecord.role,
    staffRecord.permissions ?? [],
  );

  if (
    requiredPermission != null &&
    !merchantHasPermission(effectivePermissions, requiredPermission)
  ) {
    const { logTenantAccessDenied } = await import("./structuredLog.js");
    logTenantAccessDenied({
      path: req.path ?? req.url,
      businessId,
      reason: "insufficient_permission",
    });
    res.status(403).json({ error: "Недостаточно прав" });
    return null;
  }

  return {
    businessId,
    staffId: staffRecord.id,
    role: staffRecord.role,
    effectivePermissions,
  };
}

async function merchantHasCatalogEdit(req: Request): Promise<boolean> {
  const telegramId = telegramIdFromRequest(req);
  const businessId = businessIdFromNonApiHint(req);
  if (!telegramId || businessId == null) return false;
  const staffRecord = await findBusinessStaffByTelegramId(businessId, telegramId);
  if (!staffRecord) return false;
  const effectivePermissions = effectiveMerchantPermissions(
    staffRecord.role,
    staffRecord.permissions ?? [],
  );
  return merchantHasPermission(effectivePermissions, MERCHANT_PERM.catalogEdit);
}

attachStaffRoutes(app, { requireStoreOwnerForApi });

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
    select: businessSubscriptionGateSelect,
  });
  if (rejectUnlessCanAcceptCustomerOrders(res, business)) {
    return null;
  }
  return business!.id;
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
    if (process.env.WEBHOOK_DEBUG === "1" && process.env.NODE_ENV !== "production") {
      const bodyKeys =
        req.body != null && typeof req.body === "object"
          ? Object.keys(req.body as object).slice(0, 12)
          : [];
      console.log("WEBHOOK BODY keys:", bodyKeys);
    }

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
      `tokenLen=${webhookRouteToken.length}`,
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
    const staff = await findBusinessStaffByTelegramId(businessId, telegramId);
    if (
      !staff ||
      (staff.role !== BusinessStaffRole.OWNER &&
        staff.role !== BusinessStaffRole.ADMIN)
    ) {
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
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found" });
  }
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
app.post("/check-admin", strictLimiter, async (req: Request, res: Response) => {
  try {
    const uid = verifiedTelegramIdFromRequest(req);
    if (!uid) {
      res.status(401).json({ isAdmin: false, error: "Unauthorized" });
      return;
    }
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
      const staff =
        tid === "" ? null : await findBusinessStaffByTelegramId(shop, tid);
      res.json({ isAdmin: staff != null });
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
    const telegramId = verifiedTelegramIdFromRequest(req);
    if (!telegramId) {
      logAuthReject({
        path: req.path ?? req.url,
        reason: "my_businesses_missing_verified_telegram",
        ...(req.ip ? { ip: req.ip } : {}),
        ...(req.correlationId ? { correlationId: req.correlationId } : {}),
      });
      res.status(401).json({
        error: "Требуется авторизация Telegram Mini App (x-telegram-init-data)",
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
      logAuthReject({
        path: req.path ?? req.url,
        reason: "my_businesses_telegram_id_spoof",
        ...(req.ip ? { ip: req.ip } : {}),
        ...(req.correlationId ? { correlationId: req.correlationId } : {}),
      });
      res.status(403).json({ error: "Несовпадение telegramId с авторизацией" });
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
    const staff = await findBusinessStaffByTelegramId(businessId, telegramId);
    if (!staff) {
      return res.status(403).json({ error: "Нет доступа" });
    }
    const payload = await buildMerchantGrowth(businessId);
    res.json(payload);
  } catch (e) {
    console.error("GET /api/platform/store-readiness:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

async function requireMerchantBotRecoveryOwner(
  req: Request,
  res: Response,
  businessId: number,
): Promise<string | null> {
  const telegramId = platformTelegramIdFromWebApp(req);
  if (!telegramId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  if (!Number.isInteger(businessId) || businessId <= 0) {
    res.status(400).json({ error: "Нужен businessId" });
    return null;
  }
  const isOwner = await platformMerchantIsStoreOwner(telegramId, businessId);
  if (!isOwner) {
    res.status(403).json({
      error: "Восстановление бота доступно только владельцу магазина",
    });
    return null;
  }
  return telegramId;
}

app.get("/api/platform/merchant-bot-status", async (req: Request, res: Response) => {
  try {
    const bidRaw = req.query.businessId;
    const businessId = Number(
      typeof bidRaw === "string" ? bidRaw : Array.isArray(bidRaw) ? bidRaw[0] : NaN,
    );
    if (!(await requireMerchantBotRecoveryOwner(req, res, businessId))) return;
    const payload = await buildMerchantBotRecoveryStatus(businessId);
    if (payload == null) {
      res.status(404).json({ error: "Магазин не найден" });
      return;
    }
    res.json(payload);
  } catch (e) {
    console.error("GET /api/platform/merchant-bot-status:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post(
  "/api/platform/merchant-bot-check",
  strictLimiter,
  requireNonEmptyJsonBody,
  async (req: Request, res: Response) => {
    try {
      const parsed = platformMerchantBotRecoveryBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: formatZodApiError(parsed.error) });
        return;
      }
      const { businessId } = parsed.data;
      if (!(await requireMerchantBotRecoveryOwner(req, res, businessId))) return;
      const payload = await buildMerchantBotRecoveryStatus(businessId);
      if (payload == null) {
        res.status(404).json({ error: "Магазин не найден" });
        return;
      }
      res.json(payload);
    } catch (e) {
      console.error("POST /api/platform/merchant-bot-check:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },
);

app.post(
  "/api/platform/merchant-bot-reconnect",
  strictLimiter,
  requireNonEmptyJsonBody,
  async (req: Request, res: Response) => {
    try {
      const parsed = platformMerchantBotRecoveryBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: formatZodApiError(parsed.error) });
        return;
      }
      const { businessId } = parsed.data;
      if (!(await requireMerchantBotRecoveryOwner(req, res, businessId))) return;
      const out = await reconnectMerchantStoreBot(businessId);
      if (!out.ok) {
        res.status(out.statusCode).json({
          error: out.error,
          ...(out.status != null ? { status: out.status } : {}),
        });
        return;
      }
      res.json({ ok: true, status: out.status });
    } catch (e) {
      console.error("POST /api/platform/merchant-bot-reconnect:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },
);

app.post(
  "/api/platform/merchant-bot-token",
  strictLimiter,
  requireNonEmptyJsonBody,
  async (req: Request, res: Response) => {
    try {
      const telegramId = platformTelegramIdFromWebApp(req);
      if (!telegramId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const parsed = platformMerchantBotTokenBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: formatZodApiError(parsed.error) });
        return;
      }
      const { businessId, newBotToken } = parsed.data;
      const out = await applyOwnerBotTokenSelfService({
        businessId,
        requesterTelegramId: telegramId,
        newBotToken,
      });
      if (!out.ok) {
        res.status(out.statusCode).json({ error: out.error });
        return;
      }
      res.json({
        ok: true,
        botUsername: out.botUsername,
        botStatus: out.botStatus,
      });
    } catch (e) {
      console.error("POST /api/platform/merchant-bot-token:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },
);

app.post("/api/telemetry/client-error", telemetryLimiter, async (req: Request, res: Response) => {
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
      const v = validateImageFile({
        mimetype: file.mimetype,
        sizeBytes: file.size,
        buffer: file.buffer,
        originalname: file.originalname,
      });
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
        const v = validateImageFile({
          mimetype: file.mimetype,
          sizeBytes: file.size,
          buffer: file.buffer,
          originalname: file.originalname,
        });
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

    const prevSettings = await prisma.settings.findUnique({
      where: { businessId: merchant.businessId },
    });

    const nextQr =
      body.qr === null || body.qr === ""
        ? null
        : body.qr != null
          ? String(body.qr).trim() || null
          : (prevSettings?.qr ?? null);
    const nextQrPublicId =
      body.qrPublicId === null || body.qrPublicId === ""
        ? null
        : body.qrPublicId != null
          ? String(body.qrPublicId).trim() || null
          : (prevSettings?.qrPublicId ?? null);

    if (body.qr !== undefined || body.qrPublicId !== undefined) {
      await syncQrReplaceCleanup({
        prisma,
        businessId: merchant.businessId,
        prevQr: prevSettings?.qr ?? null,
        prevQrPublicId: prevSettings?.qrPublicId ?? null,
        nextQr,
        nextQrPublicId,
        actor: { actorType: "merchant", actorUserId: merchant.staffId },
      });
    }

    const data = {
      mbank: body.mbank,
      optima: body.optima,
      obank: body.obank ?? body.other,
      card: body.card,
      qr: body.qr,
      qrPublicId: body.qrPublicId,
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
    res.status(500).json({ error: API_ERR_SERVER });
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
    res.status(500).json({ error: API_ERR_SERVER });
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
      invalidateStorefrontCache(businessId);
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
    res.status(500).json({ error: API_ERR_SERVER });
  }
});

app.post("/promo/list", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
    if (!merchant) return;
    res.json(await listPromosFromDb(prisma, merchant.businessId));
  } catch (e) {
    console.error("PROMO LIST ERROR:", e);
    res.status(500).json({ error: API_ERR_SERVER });
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
    invalidateStorefrontCache(merchant.businessId);
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

    invalidateStorefrontCache(merchant.businessId);
    res.status(204).send();
  } catch (e) {
    console.error("PROMO DELETE ERROR:", e);
    res.status(500).json({ error: API_ERR_SERVER });
  }
});

// ================== CATEGORIES ==================
app.get("/categories", async (_req: Request, res: Response) => {
  try {
    const businessId = await resolveCatalogBusinessId(_req, res);
    if (!businessId) return;
    const categories = await prisma.category.findMany({
      where: { businessId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { _count: { select: { products: true } } },
    });

    const rows = categories.map((c) => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId ?? null,
      sortOrder: c.sortOrder,
      productsCount: c._count.products,
      config: (c as { config?: unknown }).config ?? {},
    }));

    res.json(buildCategoryTree(rows));
  } catch (e) {
    console.error("GET CATEGORIES ERROR:", e);
    res.status(500).json({ error: "Ошибка получения категорий" });
  }
});

app.patch("/categories/reorder", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.catalogEdit);
    if (!merchant) return;
    const body = req.body as { updates?: unknown };
    if (!Array.isArray(body.updates) || body.updates.length === 0) {
      return res.status(400).json({ error: "Укажите updates" });
    }
    const updates: Array<{ id: number; sortOrder: number; parentId?: number | null }> = [];
    for (const raw of body.updates) {
      if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
        return res.status(400).json({ error: "Неверный формат updates" });
      }
      const o = raw as Record<string, unknown>;
      const id = Number(o.id);
      const sortOrder = Number(o.sortOrder);
      if (!Number.isFinite(id) || !Number.isFinite(sortOrder)) {
        return res.status(400).json({ error: "Неверный формат updates" });
      }
      const item: { id: number; sortOrder: number; parentId?: number | null } = {
        id,
        sortOrder,
      };
      if (o.parentId !== undefined) {
        item.parentId =
          o.parentId == null || o.parentId === ""
            ? null
            : Number(o.parentId);
      }
      updates.push(item);
    }
    const result = await reorderCategories(merchant.businessId, updates);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (e) {
    console.error("PATCH /categories/reorder:", e);
    res.status(500).json({ error: "Ошибка сортировки категорий" });
  }
});

app.patch("/categories/:id", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.catalogEdit);
    if (!merchant) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }
    const body = req.body as {
      name?: unknown;
      parentId?: unknown;
      sortOrder?: unknown;
    };
    const input: {
      name?: string;
      parentId?: number | null;
      sortOrder?: number;
    } = {};
    if (body.name !== undefined) input.name = String(body.name);
    if (body.parentId !== undefined) {
      input.parentId =
        body.parentId == null || body.parentId === ""
          ? null
          : Number(body.parentId);
    }
    if (body.sortOrder !== undefined) input.sortOrder = Number(body.sortOrder);
    const result = await updateCategory(merchant.businessId, id, input);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result.category);
  } catch (e) {
    console.error("PATCH /categories/:id:", e);
    res.status(500).json({ error: "Ошибка обновления категории" });
  }
});

app.post("/categories/restore-defaults", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.catalogEdit);
    if (!merchant) return;
    const business = await prisma.business.findUnique({
      where: { id: merchant.businessId },
      select: { businessType: true },
    });
    const bt = (business as { businessType?: string } | null)?.businessType;
    if (typeof bt !== "string" || bt.trim() === "") {
      return res.status(400).json({ error: "У магазина не задан тип бизнеса" });
    }
    const { restoreDefaultCategories } = await import("./applyBusinessTemplate.js");
    const result = await restoreDefaultCategories({
      prisma,
      businessId: merchant.businessId,
      businessType: bt as import("@prisma/client").BusinessType,
    });
    invalidateStorefrontCache(merchant.businessId);
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error("POST /categories/restore-defaults:", e);
    res.status(500).json({ error: "Не удалось восстановить категории" });
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
    const code = (e as { code?: string }).code;
    if (code === "P2002") {
      const parentIdRaw = (req.body as { parentId?: unknown }).parentId;
      const parentId =
        parentIdRaw == null || parentIdRaw === "" ? null : Number(parentIdRaw);
      return res.status(400).json({
        error:
          parentId != null
            ? "В этой категории уже есть подкатегория с таким названием"
            : "Корневая категория с таким названием уже существует",
      });
    }
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
      imagesMeta?: unknown;
      description?: unknown;
      categoryId?: unknown;
      attributes?: unknown;
      variants?: unknown;
      discountPercent?: unknown;
      isSale?: unknown;
      isNew?: unknown;
      isPopular?: unknown;
      status?: unknown;
    };

    const {
      name,
      price,
      image,
      images,
      imagesMeta: imagesMetaRaw,
      description,
      categoryId,
      attributes,
      variants,
      discountPercent,
      isSale,
      isNew,
      isPopular,
      status: statusRaw,
    } = body;

    const attributesWithCommerce: Record<string, unknown> =
      attributes != null &&
      typeof attributes === "object" &&
      !Array.isArray(attributes)
        ? { ...(attributes as Record<string, unknown>) }
        : {};
    if (discountPercent !== undefined) {
      attributesWithCommerce.discountPercent = discountPercent;
    }
    if (isSale !== undefined) attributesWithCommerce.isSale = isSale;
    if (isNew !== undefined) attributesWithCommerce.isNew = isNew;
    if (isPopular !== undefined) attributesWithCommerce.isPopular = isPopular;

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
    const merchantConfig =
      (b2 as any)?.merchantConfig != null &&
      typeof (b2 as any).merchantConfig === "object" &&
      !Array.isArray((b2 as any).merchantConfig)
        ? ((b2 as any).merchantConfig as Record<string, unknown>)
        : {};
    const vAttr = mergeProductAttributesWithVariants(
      businessType as any,
      attributesWithCommerce,
      variants,
      { businessId: merchant.businessId },
      merchantConfig,
    );
    if (!vAttr.ok) {
      return res.status(400).json({ error: vAttr.error, details: vAttr.details });
    }

    const createStatus = parseProductStatus(statusRaw) ?? "ACTIVE";

    const imagesMeta = prepareProductImagesMeta({
      urls: imageList,
      prevImagesMeta: [],
      incomingImagesMeta: imagesMetaRaw,
    });

    const product = await prisma.product.create({
      // Prisma Client types may lag schema changes in editor; runtime column exists after migration.
      data: {
        name: String(name),
        price: Number(price),
        image: primaryImage,
        images: imageList,
        imagesMeta: imagesMetaToJson(imagesMeta) as Prisma.InputJsonValue,
        description:
          description != null && String(description).trim() !== ""
            ? String(description).trim()
            : null,
        categoryId: normalizedCategoryId,
        businessId: merchant.businessId,
        attributes: vAttr.value,
        status: createStatus,
      } as any,
      include: {
        category: true,
      },
    });

    await auditProductImagesOnCreate({
      prisma,
      businessId: merchant.businessId,
      productId: product.id,
      imagesMeta,
      actor: { actorType: "merchant", actorUserId: merchant.staffId },
    });

    const variantRows = extractVariantsFromProductPayload(vAttr.value, variants);
    if (variantRows.length > 0) {
      await syncProductStockFromVariants({
        businessId: merchant.businessId,
        productId: product.id,
        variants: variantRows,
      });
      const stockMap = await loadStockRowsByProductIds(merchant.businessId, [
        product.id,
      ]);
      const attrs =
        vAttr.value != null &&
        typeof vAttr.value === "object" &&
        !Array.isArray(vAttr.value)
          ? (vAttr.value as Record<string, unknown>)
          : {};
      const issues = findStockConsistencyIssues({
        catalogVariantsRaw: attrs.variants,
        stockRows: stockMap.get(product.id) ?? [],
      });
      if (issues.length > 0) {
        logInventoryMismatch({
          businessId: merchant.businessId,
          productId: product.id,
          issues,
        });
      }
    }

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
  logVerbose("ORDER STATUS:", stRaw);
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
      blocksManualFinikPaymentConfirm({
        paymentMethod: existing.paymentMethod,
        targetStatus: st,
      })
    ) {
      return {
        ok: false,
        statusCode: 400,
        error:
          "Finik: оплата подтверждается автоматически. Используйте «Проверить статус оплаты».",
      };
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
    void onOrderStatusChanged(orderId, cur, st);
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
    res.status(500).json({ error: API_ERR_SERVER });
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
    res.status(500).json({ error: API_ERR_SERVER });
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
        blocksManualFinikPaymentConfirm({
          paymentMethod: exists.paymentMethod,
          targetStatus: data.status,
        })
      ) {
        return res.status(400).json({
          error:
            "Finik: оплата подтверждается автоматически. Используйте «Проверить статус оплаты».",
        });
      }
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

app.post("/orders/:id/sync-finik-payment", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.ordersManage);
    if (!merchant) return;

    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ error: "Неверный id" });
    }

    const result = await syncFinikOrderPayment(orderId, merchant.businessId);
    if (!result.ok) {
      return res.status(result.statusCode).json({ error: result.error });
    }

    return res.json(
      jsonWithBigInt({
        ok: true,
        paymentState: result.paymentState,
        duplicate: result.duplicate ?? false,
        order: result.order,
      })
    );
  } catch (e) {
    console.error("POST /orders/:id/sync-finik-payment:", e);
    res.status(500).json({ error: API_ERR_SERVER });
  }
});

app.delete("/orders/clear", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.ordersManage);
    if (!merchant) return;

    const rawType = Array.isArray(req.query.type)
      ? req.query.type[0]
      : req.query.type;
    const type = String(rawType ?? "all").toLowerCase();

    // Исторические алиасы из UI:
    // - completed -> CONFIRMED | SHIPPED | DELIVERED (финальные успешные статусы)
    // - rejected  -> CANCELLED (отклонён/отменён)
    const baseWhere: Prisma.OrderWhereInput = {
      businessId: merchant.businessId,
    };
    let statusFilter: Prisma.EnumOrderStatusFilter | undefined;
    if (type === "completed") {
      statusFilter = { in: ["CONFIRMED", "SHIPPED", "DELIVERED"] };
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

app.post("/merchant/workload", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.ordersManage);
    if (!merchant) return;
    const payload = await buildMerchantWorkload(merchant.businessId);
    const inventoryHealth = await healBusinessInventory(merchant.businessId, {
      dryRun: true,
    });
    res.json({
      ...payload,
      inventoryHealth: {
        mismatchCount: inventoryHealth.mismatchCount,
        hasMismatch: inventoryHealth.mismatchCount > 0,
        message:
          inventoryHealth.mismatchCount > 0
            ? "Обнаружено расхождение остатков. Система синхронизирует автоматически."
            : null,
      },
    });
  } catch (e) {
    console.error("WORKLOAD ERROR:", e);
    res.status(500).json({ error: "workload failed" });
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

// ================== MERCHANT CRM (Phase 15) ==================
app.post("/merchant/customers", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.analyticsView);
    if (!merchant) return;

    const body = req.body as
      | {
          search?: unknown;
          segment?: unknown;
          limit?: unknown;
          offset?: unknown;
        }
      | null
      | undefined;

    const allowedSegments = [
      "best",
      "high_value",
      "frequent",
      "returning",
      "recent",
      "inactive",
    ] as const;
    const segmentRaw = String(body?.segment ?? "").trim();
    const segment = (allowedSegments as readonly string[]).includes(segmentRaw)
      ? (segmentRaw as (typeof allowedSegments)[number])
      : null;

    const payload = await buildMerchantCustomerList({
      businessId: merchant.businessId,
      search: typeof body?.search === "string" ? body.search : null,
      segment,
      limit: Number.isFinite(Number(body?.limit)) ? Number(body?.limit) : undefined,
      offset: Number.isFinite(Number(body?.offset)) ? Number(body?.offset) : undefined,
    });
    res.json(payload);
  } catch (e) {
    console.error("POST /merchant/customers:", e);
    res.status(500).json({ error: "customers failed" });
  }
});

app.post("/merchant/customers/detail", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.analyticsView);
    if (!merchant) return;

    const body = req.body as { customerKey?: unknown } | null | undefined;
    const customerKey = String(body?.customerKey ?? "").trim();
    if (customerKey === "") {
      return res.status(400).json({ error: "Нужен customerKey" });
    }

    const payload = await buildMerchantCustomerDetail({
      businessId: merchant.businessId,
      customerKey,
    });
    res.json(payload);
  } catch (e) {
    console.error("POST /merchant/customers/detail:", e);
    res.status(500).json({ error: "customer detail failed" });
  }
});

app.post("/merchant/customers/dashboard", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.analyticsView);
    if (!merchant) return;

    const body = req.body as { rangeDays?: unknown } | null | undefined;
    const rd = Number(body?.rangeDays);
    const rangeDays = rd === 7 || rd === 30 || rd === 90 ? rd : 30;

    const [dashboard, insights] = await Promise.all([
      buildMerchantCustomerDashboard({
        businessId: merchant.businessId,
        rangeDays,
      }),
      buildMerchantCustomerInsights({ businessId: merchant.businessId }),
    ]);
    res.json({ ...dashboard, insights });
  } catch (e) {
    console.error("POST /merchant/customers/dashboard:", e);
    res.status(500).json({ error: "customer dashboard failed" });
  }
});

// ================== MERCHANT MARKETING & GROWTH (Phase 16) ==================
app.get("/merchant/marketing/promotions", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.analyticsView);
    if (!merchant) return;
    const promotions = await listMerchantPromotions({ businessId: merchant.businessId });
    res.json({ promotions });
  } catch (e) {
    console.error("GET /merchant/marketing/promotions:", e);
    res.status(500).json({ error: "promotions failed" });
  }
});

app.post("/merchant/marketing/promotions", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
    if (!merchant) return;
    const result = await createMerchantPromotion({
      businessId: merchant.businessId,
      definition: (req.body ?? {}) as Record<string, unknown>,
    });
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    invalidateStorefrontCache(merchant.businessId);
    res.status(201).json(result.promotion);
  } catch (e) {
    console.error("POST /merchant/marketing/promotions:", e);
    res.status(500).json({ error: "create promotion failed" });
  }
});

app.post("/merchant/marketing/promotions/:id/active", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
    if (!merchant) return;
    const promotionId = Number(req.params.id);
    if (!Number.isFinite(promotionId)) {
      return res.status(400).json({ error: "Неверный id" });
    }
    const body = req.body as { active?: unknown } | null | undefined;
    const result = await setMerchantPromotionActive({
      businessId: merchant.businessId,
      promotionId,
      active: body?.active === true,
    });
    if (!result.ok) return res.status(404).json({ error: "Не найдено" });
    invalidateStorefrontCache(merchant.businessId);
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /merchant/marketing/promotions/:id/active:", e);
    res.status(500).json({ error: "update promotion failed" });
  }
});

app.delete("/merchant/marketing/promotions/:id", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
    if (!merchant) return;
    const promotionId = Number(req.params.id);
    if (!Number.isFinite(promotionId)) {
      return res.status(400).json({ error: "Неверный id" });
    }
    const result = await deleteMerchantPromotion({
      businessId: merchant.businessId,
      promotionId,
    });
    if (!result.ok) return res.status(404).json({ error: "Не найдено" });
    invalidateStorefrontCache(merchant.businessId);
    res.status(204).end();
  } catch (e) {
    console.error("DELETE /merchant/marketing/promotions/:id:", e);
    res.status(500).json({ error: "delete promotion failed" });
  }
});

app.get("/merchant/marketing/campaigns", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.analyticsView);
    if (!merchant) return;
    const campaigns = await listMerchantCampaigns({ businessId: merchant.businessId });
    res.json({ campaigns });
  } catch (e) {
    console.error("GET /merchant/marketing/campaigns:", e);
    res.status(500).json({ error: "campaigns failed" });
  }
});

app.post("/merchant/marketing/campaigns", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
    if (!merchant) return;
    const result = await createMerchantCampaign({
      businessId: merchant.businessId,
      definition: (req.body ?? {}) as Record<string, unknown>,
    });
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    res.status(201).json(result.campaign);
  } catch (e) {
    console.error("POST /merchant/marketing/campaigns:", e);
    res.status(500).json({ error: "create campaign failed" });
  }
});

app.post("/merchant/marketing/campaigns/:id/state", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
    if (!merchant) return;
    const campaignId = Number(req.params.id);
    if (!Number.isFinite(campaignId)) {
      return res.status(400).json({ error: "Неверный id" });
    }
    const body = req.body as { active?: unknown; paused?: unknown } | null | undefined;
    const result = await setMerchantCampaignState({
      businessId: merchant.businessId,
      campaignId,
      ...(typeof body?.active === "boolean" ? { active: body.active } : {}),
      ...(typeof body?.paused === "boolean" ? { paused: body.paused } : {}),
    });
    if (!result.ok) return res.status(404).json({ error: "Не найдено" });
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /merchant/marketing/campaigns/:id/state:", e);
    res.status(500).json({ error: "update campaign failed" });
  }
});

app.delete("/merchant/marketing/campaigns/:id", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
    if (!merchant) return;
    const campaignId = Number(req.params.id);
    if (!Number.isFinite(campaignId)) {
      return res.status(400).json({ error: "Неверный id" });
    }
    const result = await deleteMerchantCampaign({
      businessId: merchant.businessId,
      campaignId,
    });
    if (!result.ok) return res.status(404).json({ error: "Не найдено" });
    res.status(204).end();
  } catch (e) {
    console.error("DELETE /merchant/marketing/campaigns/:id:", e);
    res.status(500).json({ error: "delete campaign failed" });
  }
});

app.post("/merchant/marketing/dashboard", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.analyticsView);
    if (!merchant) return;
    const body = req.body as { rangeDays?: unknown } | null | undefined;
    const rd = Number(body?.rangeDays);
    const rangeDays = rd === 7 || rd === 30 || rd === 90 ? rd : 30;
    const payload = await buildMarketingDashboard({
      businessId: merchant.businessId,
      rangeDays,
    });
    res.json(payload);
  } catch (e) {
    console.error("POST /merchant/marketing/dashboard:", e);
    res.status(500).json({ error: "marketing dashboard failed" });
  }
});

app.get("/merchant/loyalty", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.analyticsView);
    if (!merchant) return;
    const payload = await buildMerchantLoyalty({ businessId: merchant.businessId });
    res.json(payload);
  } catch (e) {
    console.error("GET /merchant/loyalty:", e);
    res.status(500).json({ error: "loyalty failed" });
  }
});

app.post("/merchant/loyalty", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
    if (!merchant) return;
    const program = await saveLoyaltyProgram(
      merchant.businessId,
      (req.body ?? {}) as Record<string, unknown>,
    );
    res.json({ program });
  } catch (e) {
    console.error("POST /merchant/loyalty:", e);
    res.status(500).json({ error: "save loyalty failed" });
  }
});

// ================== MERCHANT WEB EXPERIENCE (Phase 17) ==================
app.get("/api/merchant/slug/availability", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
    if (!merchant) return;
    const slug = String(req.query.slug ?? "");
    const result = await checkSlugAvailability({
      businessId: merchant.businessId,
      slug,
    });
    res.json(result);
  } catch (e) {
    console.error("GET /api/merchant/slug/availability:", e);
    res.status(500).json({ error: "slug availability failed" });
  }
});

app.post("/api/merchant/slug", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
    if (!merchant) return;
    const body = req.body as { slug?: unknown } | null | undefined;
    const slug = String(body?.slug ?? "");
    const result = await changeMerchantSlug({
      businessId: merchant.businessId,
      slug,
    });
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    invalidateStorefrontCache(merchant.businessId);
    res.json({ slug: result.slug, previousSlug: result.previousSlug });
  } catch (e) {
    console.error("POST /api/merchant/slug:", e);
    res.status(500).json({ error: "slug change failed" });
  }
});

app.get("/api/merchant/web-profile", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
    if (!merchant) return;
    const biz = await prisma.business.findUnique({
      where: { id: merchant.businessId },
      select: { merchantConfig: true },
    });
    const profile = extractWebProfile(
      (biz?.merchantConfig as Record<string, unknown> | null) ?? null,
    );
    res.json({ profile });
  } catch (e) {
    console.error("GET /api/merchant/web-profile:", e);
    res.status(500).json({ error: "web profile failed" });
  }
});

app.post("/api/merchant/web-profile", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.settingsManage);
    if (!merchant) return;
    const profile = normalizeWebProfile(req.body ?? {});
    const biz = await prisma.business.findUnique({
      where: { id: merchant.businessId },
      select: { merchantConfig: true },
    });
    const merged = mergeWebProfileIntoMerchantConfig(
      (biz?.merchantConfig as Record<string, unknown> | null) ?? null,
      profile,
    );
    await prisma.business.update({
      where: { id: merchant.businessId },
      data: { merchantConfig: merged as any },
    });
    invalidateStorefrontCache(merchant.businessId);
    res.json({ profile });
  } catch (e) {
    console.error("POST /api/merchant/web-profile:", e);
    res.status(500).json({ error: "save web profile failed" });
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
    const merchant = await requireMerchantStaff(req, res, [
      MERCHANT_PERM.ordersManage,
      MERCHANT_PERM.analyticsView,
    ]);
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
    const merchant = await requireMerchantStaff(req, res, [
      MERCHANT_PERM.ordersManage,
      MERCHANT_PERM.analyticsView,
    ]);
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
    const merchant = await requireMerchantStaff(req, res, [
      MERCHANT_PERM.ordersManage,
      MERCHANT_PERM.analyticsView,
    ]);
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

async function mapCatalogProductsToJson(
  businessId: number,
  products: CatalogProductRow[],
  businessType: string | null,
) {
  const stockMap = await loadStockRowsByProductIds(
    businessId,
    products.map((p) => p.id),
  );
  return products.map((p) => ({
    ...toPublicProduct(p, {
      businessType: businessType as any,
      stockRows: stockMap.get(p.id) ?? [],
    }),
    status: p.status,
    category: p.category,
  }));
}

// ================== GET PRODUCTS ==================
app.patch("/products/bulk", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.catalogEdit);
    if (!merchant) return;
    const ids = parseBulkProductIds(req.body);
    if (!ids) {
      return res.status(400).json({ error: "Укажите ids" });
    }
    const patch = parseProductBulkPatch(req.body);
    if (!patch) {
      return res.status(400).json({ error: "Нет полей для обновления" });
    }
    try {
      const result = await bulkPatchProducts(merchant.businessId, ids, patch);
      res.json(result);
    } catch (e) {
      if (e instanceof Error && e.message === "INVALID_CATEGORY") {
        return res.status(400).json({ error: "Неверная категория" });
      }
      throw e;
    }
  } catch (e) {
    console.error("PATCH /products/bulk:", e);
    res.status(500).json({ error: "Ошибка массового обновления" });
  }
});

app.get("/products", async (req: Request, res: Response) => {
  try {
    const businessId = await resolveCatalogBusinessId(req, res);
    if (!businessId) return;

    const query = parseProductListQuery(req.query as Record<string, unknown>);
    if (queryRequiresMerchantCatalogAccess(query)) {
      const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.catalogEdit);
      if (!merchant) return;
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { businessType: true },
    });
    const bt = business?.businessType ?? null;

    const result = await listProducts(businessId, query);
    const mapped = Array.isArray(result)
      ? await mapCatalogProductsToJson(businessId, result, bt)
      : await mapCatalogProductsToJson(businessId, result.items, bt);
    if (Array.isArray(result)) {
      res.json(mapped);
      return;
    }
    res.json({
      items: mapped,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
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
    const [product, business] = await Promise.all([
      prisma.product.findUnique({
        where: { id },
        include: {
          category: {
            include: {
              parent: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.business.findUnique({
        where: { id: businessId },
        select: { businessType: true },
      }),
    ]);
    if (!product) {
      return res.status(404).json({ error: "Товар не найден" });
    }
    if (product.businessId !== businessId) {
      return res.status(404).json({ error: "Товар не найден" });
    }
    if (!isProductVisibleOnStorefront(product.status)) {
      const authed = await runRequireTelegramAuth(req, res);
      if (!authed) return;
      const canManage = await merchantHasCatalogEdit(req);
      if (!canManage) {
        return res.status(404).json({ error: "Товар не найден" });
      }
    }
    const stockMap = await loadStockRowsByProductIds(businessId, [product.id]);
    res.json({
      ...toPublicProduct(product, {
        businessType: business?.businessType ?? null,
        stockRows: stockMap.get(product.id) ?? [],
      }),
      status: product.status,
      category: product.category,
    });
  } catch (error) {
    console.error("GET PRODUCT ERROR:", error);
    res.status(500).json({ error: "Ошибка получения товара" });
  }
});

app.post("/products/:id/restore", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.catalogEdit);
    if (!merchant) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }
    const result = await restoreProduct(merchant.businessId, id);
    if (!result.ok) {
      return res.status(result.status).json({ error: "Товар не найден" });
    }
    res.json(result.product);
  } catch (e) {
    console.error("POST /products/:id/restore:", e);
    res.status(500).json({ error: "Ошибка восстановления товара" });
  }
});

app.post("/products/:id/duplicate", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.catalogEdit);
    if (!merchant) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }
    const result = await duplicateProduct(merchant.businessId, id);
    if (!result.ok) {
      return res.status(result.status).json({ error: "Товар не найден" });
    }
    const stockMap = await loadStockRowsByProductIds(merchant.businessId, [
      result.product.id,
    ]);
    const business = await prisma.business.findUnique({
      where: { id: merchant.businessId },
      select: { businessType: true },
    });
    res.status(201).json({
      ...toPublicProduct(result.product, {
        businessType: business?.businessType ?? null,
        stockRows: stockMap.get(result.product.id) ?? [],
      }),
      status: result.product.status,
      category: result.product.category,
    });
  } catch (e) {
    console.error("POST /products/:id/duplicate:", e);
    res.status(500).json({ error: "Ошибка дублирования товара" });
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
  supportLimiter,
});

attachDeliveryOffersRoutes(app, {
  tryOperatorUnlock: tryOperatorUnlockSilent,
  requireMerchantStaff,
  telegramIdFromRequest,
});

attachDeliveryCalculateRoutes(app, {
  telegramIdFromRequest,
});

attachDeliveryCheckoutQuoteRoutes(app, {
  telegramIdFromRequest,
});

attachDeliveryYandexWebhookRoutes(app);

attachDeliveryTrackingRoutes(app, {
  telegramIdFromRequest,
  resolveCatalogBusinessId,
  requireMerchantStaff,
  ordersManagePermission: MERCHANT_PERM.ordersManage,
});

attachDeliveryHealthRoutes(app);

attachDeliveryMerchantDashboardRoutes(app, {
  requireMerchantStaff,
  ordersManagePermission: MERCHANT_PERM.ordersManage,
});

attachDeliveryOperationsRoutes(app, {
  operatorAuth: {
    requireOperatorUnlock,
    requireOperatorRecentReauth,
  },
  requireMerchantStaff,
  ordersManagePermission: MERCHANT_PERM.ordersManage,
  telegramIdFromRequest: verifiedTelegramIdFromRequest,
  orderOwnedByTelegramUser: async (orderId, telegramId) => {
    const order = await prisma.order.findFirst({
      where: { id: orderId, buyerUser: { telegramId } },
      select: { id: true },
    });
    return order != null;
  },
});

attachDeliveryEngineRoutes(app, {
  operatorAuth: { requireOperatorUnlock },
  requireMerchantStaff,
  settingsManagePermission: MERCHANT_PERM.settingsManage,
});

attachDiningTableRoutes(app, { requireMerchantStaff });

attachTableReservationRoutes(app, {
  requireMerchantStaff,
  telegramIdFromRequest: verifiedTelegramIdFromRequest,
});

attachWaitlistRoutes(app, {
  requireMerchantStaff,
  telegramIdFromRequest: verifiedTelegramIdFromRequest,
});

attachVenueOperationsRoutes(app, {
  requireMerchantStaff,
  telegramIdFromRequest: verifiedTelegramIdFromRequest,
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
app.post("/orders", ordersLimiter, async (req: Request, res: Response) => {
  try {
  const body = req.body;

  if (!body.items) {
    return res.status(400).json({ error: "Неверные данные заказа" });
  }

  const verifiedTg = telegramIdFromRequest(req);
  if (!verifiedTg) {
    return res.status(401).json({
      error: "Требуется авторизация Telegram Mini App",
    });
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

  const items: Array<{
    productId: number;
    name: string;
    size: string;
    color: string;
    options?: unknown;
    quantity: number;
    price: number;
  }> = [];
  for (const item of rawItems) {
    const productId = coercePositiveInt(item.productId);
    const quantity = coercePositiveInt(item.quantity);
    const priceRaw = Number(item.price);
    const price =
      Number.isFinite(priceRaw) && priceRaw >= 0 ? Math.round(priceRaw) : null;
    if (productId == null || quantity == null || price == null) {
      return res.status(400).json({ error: "Неверные данные позиции в заказе" });
    }
    items.push({
      productId,
      name: cleanInput(item.name),
      size: cleanInput(item.size),
      color: cleanInput(item.color),
      options: item.options,
      quantity,
      price,
    });
  }

  const probe = await prisma.product.findUnique({
    where: { id: items[0]!.productId },
    select: { businessId: true },
  });
  if (!probe) {
    return res.status(400).json({ error: "Товар не найден" });
  }
  const tenantBusinessId = probe.businessId;

  await syncBusinessSubscriptionActivationState(tenantBusinessId);
  const biz = await prisma.business.findUnique({
    where: { id: tenantBusinessId },
    select: {
      ...businessSubscriptionGateSelect,
      businessType: true,
      deliverySettings: true,
      storeAvailabilitySettings: true,
      latitude: true,
      longitude: true,
      finikApiKey: true,
      finikAccountId: true,
      finikSecret: true,
    },
  });
  if (rejectUnlessCanAcceptCustomerOrders(res, biz)) {
    return;
  }
  if (!isMerchantStorefrontFinikCheckoutAllowed(biz!)) {
    return res.status(503).json({ error: MERCHANT_FINIK_CHECKOUT_UNAVAILABLE });
  }
  const businessType = biz!.businessType;
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
    return res.status(403).json({ error: API_ERR_FORBIDDEN });
  }

  const promoRaw = String(body.promo ?? body.promoCode ?? "").trim();
  const corrId = req.correlationId;

  logCheckoutStep({
    step: "validated",
    phase: "ok",
    businessId: tenantBusinessId,
    ...(corrId ? { correlationId: corrId } : {}),
    detail: `items=${itemsValidated.length} type=${businessType}`,
  });

  logCommerceEvent({
    phase: "checkout_start",
    businessId: tenantBusinessId,
    ...(corrId ? { correlationId: corrId } : {}),
  });

  const schemaProbe = await getCachedCheckoutSchemaProbe(prisma);
  if (!schemaProbe.ok) {
    logCheckoutReject({
      businessId: tenantBusinessId,
      reason: `schema_missing:${schemaProbe.missing.join(",")}`,
      ...(corrId ? { correlationId: corrId } : {}),
    });
    return res.status(503).json({
      error:
        "База данных не обновлена. Администратору нужно выполнить миграции.",
      checkoutSchemaMissing: schemaProbe.missing,
    });
  }

  let reservationIdForOrder: number | null = null;
  try {
    const rawTableSessionBody = (body as { tableSessionId?: unknown }).tableSessionId;
    const hasTableSession =
      rawTableSessionBody != null && Number.isFinite(Number(rawTableSessionBody));
    reservationIdForOrder = await resolveCheckoutReservationId({
      businessId: tenantBusinessId,
      reservationId: (body as { reservationId?: unknown }).reservationId,
      guestTelegramId: verifiedTg,
      hasTableSession,
    });
  } catch (resErr) {
    const msg = resErr instanceof Error ? resErr.message : String(resErr);
    if (msg === "RESERVATION_SESSION_CONFLICT") {
      return res.status(400).json({
        error: "Нельзя оформить предзаказ к брони и заказ за столом одновременно",
      });
    }
    if (msg === "INVALID_RESERVATION") {
      return res.status(400).json({ error: "Некорректная бронь" });
    }
    if (msg.startsWith("RESERVATION:")) {
      const parts = msg.split(":");
      const status = Number(parts[1]) || 400;
      const errorText = parts.slice(2).join(":") || "Бронь недоступна";
      return res.status(status).json({ error: errorText });
    }
    throw resErr;
  }

  let order: {
    id: number;
    businessId: number;
    total: number;
    status: string;
    address: string | null;
    phone: string | null;
    orderNumber: string | null;
    items: Array<{
      id: number;
      productId: number | null;
      size: string;
      color: string;
      quantity: number;
      name: string;
    }>;
  };
  let buyerUser: { id: number; name: string | null };

  try {
    void releaseStaleUnpaidOrders({ businessId: tenantBusinessId });

    const checkoutCtx = {
      ...(corrId ? { correlationId: corrId } : {}),
    };

    const checkoutResult = await prisma.$transaction(async (tx) => {
      const priced = await runCheckoutStep(
        "pricing",
        tenantBusinessId,
        async () => {
          const result = await priceCheckoutLines(
            tx,
            tenantBusinessId,
            businessType,
            itemsValidated.map((it) => ({
              productId: it.productId,
              size: it.size,
              color: it.color,
              quantity: it.quantity,
              options: it.optionsValidated,
            })),
          );
          if (!result.ok) {
            throw new Error(`PRICE:${result.statusCode}:${result.error}`);
          }
          return result;
        },
        checkoutCtx,
      );

      let orderTotal = priced.subtotal;
      if (promoRaw) {
        await runCheckoutStep("promo", tenantBusinessId, async () => {
          try {
            const applied = await tryApplyPromoDb(
              tx as unknown as typeof prisma,
              tenantBusinessId,
              promoRaw,
              priced.subtotal,
            );
            orderTotal = applied.newTotal;
          } catch (pe) {
            throw new Error(`PROMO:${promoApplyErrorMessage(pe)}`);
          }
        }, checkoutCtx);
      }

      const deliveryModeParsed = parseCheckoutDeliveryMode(
        body as { deliveryMode?: unknown; deliveryType?: unknown },
      );

      const deliveryQuoteResult = await runCheckoutStep(
        "delivery_quote",
        tenantBusinessId,
        async () => {
          const fulfillmentMode =
            deliveryModeParsed === DeliveryMode.PICKUP ? "PICKUP" : "DELIVERY";
          const result = await resolveHybridCheckoutDelivery({
            merchantId: tenantBusinessId,
            destination: {
              latitude: orderLat ?? 0,
              longitude: orderLng ?? 0,
            },
            subtotalSom: priced.subtotal,
            fulfillmentMode,
            ...(checkoutCtx.correlationId
              ? { correlationId: checkoutCtx.correlationId }
              : {}),
          });
          if (!result.ok) {
            const statusCode =
              CHECKOUT_DELIVERY_QUOTE_HTTP_STATUS[result.code] ?? 400;
            throw new Error(`DELIVERY:${statusCode}:${result.message}`);
          }
          if (
            result.provider === MERCHANT_OWNED_DELIVERY_PROVIDER &&
            result.providerOfferId != null
          ) {
            throw new Error("DELIVERY:500:Некорректная конфигурация доставки магазина");
          }
          return result;
        },
        checkoutCtx,
      );

      const deliveryFeeSom = deliveryQuoteResult.deliveryFeeSom;
      orderTotal = coerceCheckoutOrderTotal(orderTotal + deliveryFeeSom);

      const telegramId = verifiedTg;
      const businessId = tenantBusinessId;
      const buyerUserInner = await runCheckoutStep(
        "customer",
        businessId,
        () =>
          upsertBuyerUser(
            tx,
            businessId,
            telegramId,
            userNameSanitized || null,
          ),
        checkoutCtx,
      );

      const cooldown = await runCheckoutStep(
        "cooldown",
        businessId,
        () =>
          checkActionCooldown(
            {
              businessId,
              userId: buyerUserInner.id,
              actionKey: "checkout",
            },
            tx,
          ),
        checkoutCtx,
      );
      if (!cooldown.ok) {
        throw new Error(`COOLDOWN:${cooldown.error}`);
      }

      const fingerprint = buildFingerprintFromCart(
        items.map((it) => ({
          productId: Number(it.productId),
          size: String(it.size),
          color: String(it.color),
          quantity: Number(it.quantity),
        })),
      );
      const dup = await runCheckoutStep(
        "duplicate_check",
        businessId,
        () =>
          assertNotDuplicateOrder(
            {
              businessId,
              buyerUserId: buyerUserInner.id,
              total: orderTotal,
              fingerprint,
            },
            tx,
          ),
        checkoutCtx,
      );
      if (!dup.ok) {
        throw new Error(`DUPLICATE:${dup.error}`);
      }

      const orderNameDisplay =
        (userNameSanitized && userNameSanitized.trim()) || "Гость";
      const addrFinal =
        orderAddress && orderAddress.trim() !== "" ? orderAddress : "—";

      const orderNumber = await runCheckoutStep(
        "order_number",
        businessId,
        () => allocateHumanOrderNumber(tx, businessId),
        checkoutCtx,
      );

      const itemCreates = buildCheckoutOrderItemRows(
        businessId,
        priced.lines,
        itemsValidated.map((it) => it.optionsValidated),
      );

      const rawTableSessionId = (body as { tableSessionId?: unknown }).tableSessionId;
      const tableSessionIdParsed =
        rawTableSessionId != null && Number.isFinite(Number(rawTableSessionId))
          ? Math.floor(Number(rawTableSessionId))
          : null;

      const order = await runCheckoutStep(
        "order_created",
        businessId,
        () =>
          tx.order.create({
            data: {
              businessId,
              buyerUserId: buyerUserInner.id,
              orderNumber,
              name: orderNameDisplay,
              phone: customerPhoneValue,
              address: addrFinal,
              total: orderTotal,
              deliveryFee: deliveryFeeSom,
              status: PrismaOrderStatus.NEW,
              lat: orderLat,
              lng: orderLng,
              paymentMethod,
              paymentId: paymentMethod === "finik" ? null : paymentId,
              tableSessionId: tableSessionIdParsed,
              reservationId: reservationIdForOrder,
              preorderStatus:
                reservationIdForOrder != null ? "PREORDER_DRAFT" : null,
              prepStatus: tableSessionIdParsed != null ? "PREPARING" : "NONE",
              ...(deliveryModeParsed === DeliveryMode.DELIVERY &&
              deliveryQuoteResult.providerOfferId
                ? { deliveryOfferId: deliveryQuoteResult.providerOfferId }
                : {}),
              ...(deliveryModeParsed === DeliveryMode.DELIVERY &&
              deliveryQuoteResult.provider
                ? { deliveryProvider: deliveryQuoteResult.provider }
                : {}),
              ...(deliveryQuoteResult.calculationSource
                ? { deliveryCalculationSource: deliveryQuoteResult.calculationSource }
                : {}),
              ...(deliveryQuoteResult.etaMinutes != null
                ? { deliveryEtaMinutes: deliveryQuoteResult.etaMinutes }
                : {}),
              ...(promoRaw
                ? { tracking: promoTrackingValue(promoRaw) }
                : {}),
              items: {
                create: itemCreates,
              },
            },
            include: {
              items: true,
            },
          }),
        checkoutCtx,
      );

      await runCheckoutStep(
        "order_created",
        businessId,
        () =>
          registerLifetimeOrderCreated({
            tx,
            businessId,
            orderId: order.id,
            initialStatus: order.status,
          }),
        { ...checkoutCtx, orderId: order.id },
      );

      const stockLines = order.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        size: it.size,
        color: it.color,
        quantity: it.quantity,
      }));
      const reserved = await runCheckoutStep(
        "stock_reserved",
        businessId,
        async () => {
          const result = await reserveOrderStock(
            tx,
            businessId,
            order.id,
            stockLines,
          );
          if (!result.ok) {
            throw new Error(`STOCK:${result.error}`);
          }
          return result;
        },
        { ...checkoutCtx, orderId: order.id },
      );
      void reserved;

      const deliveryMode = deliveryModeParsed;
      const rawPrep = (body as { preparationMinutes?: unknown }).preparationMinutes;
      const availParsed = parseStoreAvailabilitySettings(
        biz!.storeAvailabilitySettings,
        String(biz!.businessType ?? ""),
      );
      const availSettings = availParsed.ok
        ? availParsed.value
        : defaultStoreAvailabilitySettings();
      let distanceKmForEta: number | null = null;
      if (
        biz!.latitude != null &&
        biz!.longitude != null &&
        orderLat != null &&
        orderLng != null
      ) {
        distanceKmForEta = haversineDistanceKm(
          { latitude: biz!.latitude, longitude: biz!.longitude },
          { latitude: orderLat, longitude: orderLng },
        );
      }
      const etaRange =
        deliveryModeParsed === DeliveryMode.PICKUP
          ? availSettings.pickupEta
          : resolveDeliveryEtaForKm(availSettings, distanceKmForEta);
      const preparationMinutes =
        rawPrep != null && Number.isFinite(Number(rawPrep))
          ? Number(rawPrep)
          : etaMidMinutes(etaRange);

      await runCheckoutStep(
        "delivery_init",
        businessId,
        () =>
          initializeOrderDelivery(tx, order.id, {
            deliveryMode,
            preparationMinutes,
          }),
        { ...checkoutCtx, orderId: order.id },
      );

      return { order, buyerUser: buyerUserInner, pricedCheckout: priced };
    });

    order = checkoutResult.order;
    buyerUser = checkoutResult.buyerUser;

    logCommerceEvent({
      phase: "order_created",
      businessId: tenantBusinessId,
      orderId: order.id,
      ...(corrId ? { correlationId: corrId } : {}),
    });
    logCommerceEvent({
      phase: "stock_reserved",
      businessId: tenantBusinessId,
      orderId: order.id,
      ...(corrId ? { correlationId: corrId } : {}),
    });

    const rawSession = (body as { tableSessionId?: unknown }).tableSessionId;
    const parsedSession =
      rawSession != null && Number.isFinite(Number(rawSession))
        ? Math.floor(Number(rawSession))
        : null;
    if (parsedSession != null && parsedSession > 0) {
      try {
        const { attachOrderToSession } = await import("./venueOperationsService.js");
        await attachOrderToSession(tenantBusinessId, order.id, parsedSession);
      } catch (venueErr) {
        console.error("attachOrderToSession after checkout:", venueErr);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("PRICE:")) {
      const parts = msg.split(":");
      const statusCode = Number(parts[1]) || 400;
      const errText = parts.slice(2).join(":") || "Ошибка цены";
      logCheckoutReject({
        businessId: tenantBusinessId,
        reason: errText,
        ...(corrId ? { correlationId: corrId } : {}),
      });
      return res.status(statusCode).json({ error: errText });
    }
    if (msg.startsWith("PROMO:")) {
      return res.status(400).json({ error: msg.slice(6) });
    }
    if (msg.startsWith("DELIVERY:")) {
      const parts = msg.split(":");
      const statusCode = Number(parts[1]) || 400;
      const errText = parts.slice(2).join(":") || "Ошибка доставки";
      return res.status(statusCode).json({ error: errText });
    }
    if (msg.startsWith("COOLDOWN:")) {
      return res.status(429).json({ error: msg.slice(9) });
    }
    if (msg.startsWith("DUPLICATE:")) {
      return res.status(409).json({ error: msg.slice(10) });
    }
    if (msg.startsWith("STOCK:")) {
      logInventoryReserveFailed({
        businessId: tenantBusinessId,
        error: msg.slice(6),
        ...(corrId ? { correlationId: corrId } : {}),
      });
      return res.status(409).json({ error: msg.slice(6) });
    }
    if (msg === "INVALID_ITEM" || msg === "INVALID_STOCK_QTY") {
      return res.status(400).json({ error: "Неверные данные позиции в заказе" });
    }
    const failure = checkoutFailureResponse(e, "POST /orders transaction");
    logCheckoutReject({
      businessId: tenantBusinessId,
      reason: String(failure.body.error),
      ...(corrId ? { correlationId: corrId } : {}),
      ...(failure.body.failedStep
        ? { detail: `step=${String(failure.body.failedStep)}` }
        : {}),
    });
    return res.status(failure.statusCode).json(failure.body);
  }

  try {
    await touchActionCooldown({
      businessId: tenantBusinessId,
      userId: buyerUser.id,
      actionKey: "checkout",
    });

    logVerbose("ORDER CREATED:", order.id);

    let paymentUrl: string | null = null;
    let orderForResponse = order;

    if (paymentMethod === "finik") {
      const business = await prisma.business.findUnique({
        where: { id: order.businessId },
        select: {
          id: true,
          finikApiKey: true,
          finikAccountId: true,
          finikSecret: true,
        },
      });
      if (!business) {
        return res.status(500).json({ error: "Магазин не найден" });
      }
      if (
        isFinikCredentialsReady(business.finikApiKey, business.finikAccountId) &&
        !canCreateFinikPayment(business)
      ) {
        await onOrderStatusChanged(order.id, "NEW", "CANCELLED");
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: "CANCELLED",
            ...(reservationIdForOrder != null
              ? { preorderStatus: "PREORDER_CANCELLED" }
              : {}),
          },
        });
        return res.status(503).json({ error: FINIK_LEGACY_HTTP_UNAVAILABLE_ERROR });
      }
      const finik = await runCheckoutStep(
        "payment_session",
        tenantBusinessId,
        () =>
          createStorefrontFinikCheckoutSession(business, {
            orderId: order.id,
            amount: order.total,
            ...(corrId ? { correlationId: corrId } : {}),
          }),
        { ...(corrId ? { correlationId: corrId } : {}), orderId: order.id },
      );
      if (!finik.ok) {
        await onOrderStatusChanged(order.id, "NEW", "CANCELLED");
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: "CANCELLED",
            ...(reservationIdForOrder != null
              ? { preorderStatus: "PREORDER_CANCELLED" }
              : {}),
          },
        });
        return res.status(502).json({ error: finik.error });
      }
      paymentUrl = finik.paymentUrl;
      logCommerceEvent({
        phase: "payment_session",
        businessId: tenantBusinessId,
        orderId: order.id,
        paymentId: finik.paymentId,
        ...(corrId ? { correlationId: corrId } : {}),
      });
      orderForResponse = await prisma.order.update({
        where: { id: order.id },
        data: { paymentId: finik.paymentId },
        include: { items: true },
      });
      if (reservationIdForOrder != null) {
        await markReservationPreorderPaymentPending(order.id);
      }
    }

    const isUnpaidReservationPreorder = reservationIdForOrder != null;
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

    const deferMerchantNotifyUntilPaid =
      paymentMethod === "finik" && !isUnpaidReservationPreorder;

    if (!isUnpaidReservationPreorder && !deferMerchantNotifyUntilPaid) {
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
    if (code.startsWith("STOCK:")) {
      return res.status(409).json({ error: code.slice("STOCK:".length) });
    }
    if (code.startsWith("COOLDOWN:")) {
      return res.status(429).json({ error: code.slice("COOLDOWN:".length) });
    }
    if (code.startsWith("DUPLICATE:")) {
      return res.status(409).json({ error: code.slice("DUPLICATE:".length) });
    }
    console.error("ORDER ERROR FULL:", error);
    const failure = checkoutFailureResponse(error, "POST /orders post-create");
    res.status(failure.statusCode).json(failure.body);
  }
  } catch (e) {
    console.error("ORDERS POST ROUTE ERROR:", e);
    if (!res.headersSent) {
      const failure = checkoutFailureResponse(e, "POST /orders outer");
      res.status(failure.statusCode).json(failure.body);
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
      const v = validateReceiptFile({
        mimetype: file.mimetype,
        sizeBytes: file.size,
        buffer: file.buffer,
        originalname: file.originalname,
      });
      if (!v.ok) {
        return res.status(400).json({ error: v.error });
      }

      const existing = await prisma.order.findUnique({ where: { id } });
      try {
        assertBusinessScope({
          authenticatedBusinessId: merchant.businessId,
          resourceBusinessId: existing?.businessId,
          resourceId: id,
        });
      } catch (scopeErr) {
        const { respondBusinessScopeError } = await import("./businessScope.js");
        if (respondBusinessScopeError(res, scopeErr, "Заказ не найден")) return;
        throw scopeErr;
      }
      if (!existing) {
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
        v.mimetype,
        merchant.businessId,
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
      imagesMeta?: unknown;
      description?: unknown;
      categoryId?: unknown;
      attributes?: unknown;
      variants?: unknown;
      discountPercent?: unknown;
      preparationMinutes?: unknown;
      isSale?: unknown;
      isNew?: unknown;
      isPopular?: unknown;
      status?: unknown;
    };

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }

    const {
      name,
      price,
      image,
      images,
      imagesMeta: imagesMetaRaw,
      description,
      categoryId,
      attributes,
      variants,
      discountPercent,
      preparationMinutes,
      isSale,
      isNew,
      isPopular,
      status: statusRaw,
    } = body;

    if (
      name === undefined &&
      price === undefined &&
      image === undefined &&
      images === undefined &&
      imagesMetaRaw === undefined &&
      description === undefined &&
      categoryId === undefined &&
      attributes === undefined &&
      variants === undefined &&
      discountPercent === undefined &&
      preparationMinutes === undefined &&
      isSale === undefined &&
      isNew === undefined &&
      isPopular === undefined &&
      statusRaw === undefined
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
      preparationMinutes?: number | null;
      status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
      imagesMeta?: Prisma.InputJsonValue;
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
    if (preparationMinutes !== undefined) {
      if (preparationMinutes === null || preparationMinutes === "") {
        scalar.preparationMinutes = null;
      } else {
        const m = Number(preparationMinutes);
        if (!Number.isFinite(m) || m < 1) {
          return res.status(400).json({ error: "Неверное время приготовления" });
        }
        scalar.preparationMinutes = Math.round(m);
      }
    }
    if (statusRaw !== undefined) {
      const st = parseProductStatus(statusRaw);
      if (!st) {
        return res.status(400).json({ error: "Неверный статус товара" });
      }
      scalar.status = st;
    }

    const exists = await prisma.product.findUnique({ where: { id } });
    if (!exists || exists.businessId !== merchant.businessId) {
      return res.status(404).json({ error: "Товар не найден" });
    }

    const imagesTouched = images !== undefined || image !== undefined;
    if (imagesTouched) {
      const nextUrls =
        scalar.images ??
        (exists.images?.length ? exists.images : exists.image ? [exists.image] : []);
      const { imagesMeta } = await syncProductImagesOnUpdate({
        prisma,
        businessId: merchant.businessId,
        productId: id,
        exists,
        nextUrls,
        incomingImagesMeta: imagesMetaRaw,
        actor: { actorType: "merchant", actorUserId: merchant.staffId },
      });
      scalar.imagesMeta = imagesMetaToJson(imagesMeta) as Prisma.InputJsonValue;
    } else if (imagesMetaRaw !== undefined) {
      const nextUrls =
        exists.images?.length ? exists.images : exists.image ? [exists.image] : [];
      const imagesMeta = prepareProductImagesMeta({
        urls: nextUrls,
        prevImagesMeta: exists.imagesMeta,
        incomingImagesMeta: imagesMetaRaw,
      });
      scalar.imagesMeta = imagesMetaToJson(imagesMeta) as Prisma.InputJsonValue;
    }

    if (
      attributes !== undefined ||
      variants !== undefined ||
      discountPercent !== undefined ||
      isSale !== undefined ||
      isNew !== undefined ||
      isPopular !== undefined
    ) {
      const b2 = await prisma.business.findUnique({
        where: { id: merchant.businessId },
      });
      const businessType = (b2 as any)?.businessType;
      if (typeof businessType !== "string" || businessType.trim() === "") {
        return res.status(400).json({ error: "Магазин без businessType" });
      }
      const merchantConfig =
        (b2 as any)?.merchantConfig != null &&
        typeof (b2 as any).merchantConfig === "object" &&
        !Array.isArray((b2 as any).merchantConfig)
          ? ((b2 as any).merchantConfig as Record<string, unknown>)
          : {};
      const baseAttrsRecord: Record<string, unknown> =
        attributes !== undefined &&
        typeof attributes === "object" &&
        !Array.isArray(attributes)
          ? { ...(attributes as Record<string, unknown>) }
          : exists.attributes != null &&
              typeof exists.attributes === "object" &&
              !Array.isArray(exists.attributes)
            ? { ...(exists.attributes as Record<string, unknown>) }
            : {};
      if (discountPercent !== undefined) {
        baseAttrsRecord.discountPercent = discountPercent;
      }
      if (isSale !== undefined) baseAttrsRecord.isSale = isSale;
      if (isNew !== undefined) baseAttrsRecord.isNew = isNew;
      if (isPopular !== undefined) baseAttrsRecord.isPopular = isPopular;
      const vAttr = mergeProductAttributesWithVariants(
        businessType as any,
        baseAttrsRecord,
        variants,
        { businessId: merchant.businessId, productId: id },
        merchantConfig,
      );
      if (!vAttr.ok) {
        return res
          .status(400)
          .json({ error: vAttr.error, details: vAttr.details });
      }
      scalar.attributes = vAttr.value;
    }

    const product = await prisma.product.update({
      where: { id },
      // Prisma UpdateInput is strict about relation scalars (categoryId) with exactOptionalPropertyTypes.
      data: scalar as any,
      include: { category: true },
    });

    const variantRows = extractVariantsFromProductPayload(
      scalar.attributes ?? product.attributes,
      variants
    );
    if (variantRows.length > 0) {
      await syncProductStockFromVariants({
        businessId: merchant.businessId,
        productId: product.id,
        variants: variantRows,
      });
      const stockMap = await loadStockRowsByProductIds(merchant.businessId, [
        product.id,
      ]);
      const attrsRaw = scalar.attributes ?? product.attributes;
      const attrs =
        attrsRaw != null &&
        typeof attrsRaw === "object" &&
        !Array.isArray(attrsRaw)
          ? (attrsRaw as Record<string, unknown>)
          : {};
      const issues = findStockConsistencyIssues({
        catalogVariantsRaw: attrs.variants,
        stockRows: stockMap.get(product.id) ?? [],
      });
      if (issues.length > 0) {
        logInventoryMismatch({
          businessId: merchant.businessId,
          productId: product.id,
          issues,
        });
      }
    }

    res.json(product);
  } catch (e) {
    console.error("UPDATE PRODUCT ERROR:", e);
    res.status(500).json({ error: "Ошибка обновления товара" });
  }
});

// ================== DELETE PRODUCT (archive) ==================
app.delete("/products/:id", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res, MERCHANT_PERM.catalogEdit);
    if (!merchant) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }

    const result = await archiveProduct(merchant.businessId, id);
    if (!result.ok) {
      return res.status(result.status).json({ error: "Товар не найден" });
    }

    res.status(204).send();
  } catch (e) {
    console.error("DELETE PRODUCT ERROR:", e);
    res.status(500).json({ error: "Ошибка архивации товара" });
  }
});

app.delete(
  "/api/platform/admin/businesses/:businessId/products/:id",
  async (req: Request, res: Response) => {
    try {
      const operator = await requireOperatorRecentReauth(req, res);
      if (!operator) return;
      const businessId = Number(req.params.businessId);
      const id = Number(req.params.id);
      if (!Number.isFinite(businessId) || !Number.isFinite(id)) {
        return res.status(400).json({ error: "Неверный id" });
      }
      const result = await purgeProductPermanent(businessId, id);
      if (!result.ok) {
        return res.status(result.status).json({ error: "Товар не найден" });
      }
      res.status(204).send();
    } catch (e) {
      console.error("DELETE platform product purge:", e);
      res.status(500).json({ error: "Ошибка удаления товара" });
    }
  },
);

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
    // Phase 17: inject per-store SEO/OG meta for crawlable routes; fall back to
    // the unmodified SPA index.html on any miss/error.
    if (isMetaInjectablePath(req.path)) {
      void renderSpaHtmlWithMeta(req, SPA_INDEX)
        .then((html) => {
          if (html == null) {
            sendSpaIndexHtml(res, next);
            return;
          }
          res.set({
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
            Pragma: "no-cache",
            "Content-Type": "text/html; charset=utf-8",
          });
          res.send(html);
        })
        .catch(() => sendSpaIndexHtml(res, next));
      return;
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
    const { backfillBusinessStaffFromLegacy } = await import(
      "./businessStaffBackfill.js"
    );
    const staffHealed = await backfillBusinessStaffFromLegacy();
    if (staffHealed > 0) {
      console.log(`[staff] Backfilled ${staffHealed} BusinessStaff row(s)`);
    }
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
    try {
      startStaleOrderCleanupScheduler();
    } catch (e) {
      console.error("startStaleOrderCleanupScheduler:", e);
    }
    try {
      startMediaDestroyScheduler();
    } catch (e) {
      console.error("startMediaDestroyScheduler:", e);
    }
    try {
      startTableReservationScheduler();
    } catch (e) {
      console.error("startTableReservationScheduler:", e);
    }
    try {
      startDeliveryRecoveryScheduler();
    } catch (e) {
      console.error("startDeliveryRecoveryScheduler:", e);
    }
  });
})();