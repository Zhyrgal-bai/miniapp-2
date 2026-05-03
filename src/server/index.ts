import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
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
import { validateAndPersistPlatformRegistration } from "./platformRegisterRequest.js";
import {
  approveRegistrationRequestById,
  isPlatformAdminTelegramId,
  listPendingRegistrationRequestsForAdmin,
  rejectRegistrationRequestById,
} from "./platformAdminService.js";
import { adminBlockBusiness, adminUnblockBusiness } from "./saasBillingService.js";
import {
  isAllowedOrderStatusTransition,
  isValidOrderStatus,
  type OrderStatus,
} from "./orderStatus.js";
import {
  adminNewOrderNotifyKeyboard,
  bot,
  bots,
  getBotForOwner,
  getNotifyTargetChatId,
  initDynamicStoreBot,
} from "../bot/bot.js";
/** Навешивает `attachBotHandlers` на клиентские боты без цикла dynamicBots ↔ bot */
import "../bot/registerDynamicBrain.js";
import { startAllBots } from "../bot/botManager.js";
import { connectDatabase, logPrismaError, prisma } from "./db.js";
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
  createFinikMerchantSession,
  mountFinikWebhookRoutes,
  mountFinikSettingsRoutes,
  publicApiOrigin,
} from "./finikMerchant.js";
import { relayDynamicStoreWebhook as relayDynamicTenantStoreWebhook } from "./storeTelegramWebhookRelay.js";
import { startSubscriptionMaintenanceScheduler } from "./subscriptionMaintenance.js";
import { cleanInput, validateKgPhone } from "./orderInputSanitize.js";
import {
  applyThemePatchAndValidate,
  publicBusinessThemeResponse,
} from "./storeTheme.js";
import {
  businessMiddleware,
  businessSubscriptionBlocked,
} from "../middleware/business.middleware.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
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

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-telegram-id",
      "x-business-id",
    ],
  })
);
app.use(express.json());
mountFinikWebhookRoutes(app);
mountFinikSettingsRoutes(app);

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
    const blocked = businessSubscriptionBlocked(
      {
        isActive: row.isActive,
        isBlocked: row.isBlocked,
        subscriptionStatus: row.subscriptionStatus,
        trialEndsAt: row.trialEndsAt,
        subscriptionEndsAt: row.subscriptionEndsAt,
      },
      new Date(),
    );
    if (blocked) {
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

/** Платформа (главный бот): до tenant middleware — без привязки к `shop`. */
function platformTelegramIdFromRequest(req: Request): string | null {
  const rawXi = req.headers["x-telegram-id"];
  const xi =
    typeof rawXi === "string"
      ? rawXi.trim()
      : Array.isArray(rawXi) && typeof rawXi[0] === "string"
        ? rawXi[0].trim()
        : "";
  if (/^\d+$/.test(xi)) return xi;

  const raw = req.query.telegramId ?? req.query.userId;
  const s =
    typeof raw === "string"
      ? raw.trim()
      : Array.isArray(raw) && typeof raw[0] === "string"
        ? raw[0].trim()
        : "";
  return /^\d+$/.test(s) ? s : null;
}

app.get("/api/platform/my-businesses", async (req: Request, res: Response) => {
  try {
    const telegramId = platformTelegramIdFromRequest(req);
    if (!telegramId) {
      res.status(400).json({
        error:
          "Нужен telegramId: заголовок x-telegram-id или query telegramId / userId",
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

app.post("/api/platform/register-request", async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const headerTid = (() => {
      const rawXi = req.headers["x-telegram-id"];
      const xi =
        typeof rawXi === "string"
          ? rawXi.trim()
          : Array.isArray(rawXi) && typeof rawXi[0] === "string"
            ? rawXi[0].trim()
            : "";
      return /^\d+$/.test(xi) ? xi : null;
    })();

    const bodyTidRaw = body.telegramId;
    const bodyTid =
      typeof bodyTidRaw === "number" && Number.isFinite(bodyTidRaw)
        ? String(Math.trunc(bodyTidRaw))
        : typeof bodyTidRaw === "string"
          ? bodyTidRaw.trim()
          : "";

    if (headerTid != null && bodyTid !== "" && headerTid !== bodyTid) {
      res.status(403).json({ error: "Несовпадение telegramId с заголовком" });
      return;
    }

    const result = await validateAndPersistPlatformRegistration(body);
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

app.get("/api/platform/admin/requests", async (req: Request, res: Response) => {
  try {
    const telegramId = platformTelegramIdFromRequest(req);
    if (!telegramId) {
      res.status(400).json({
        error: "Нужен Telegram id (x-telegram-id или query telegramId / userId)",
      });
      return;
    }
    if (!isPlatformAdminTelegramId(telegramId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const rows = await listPendingRegistrationRequestsForAdmin();
    res.json(rows);
  } catch (e) {
    console.error("GET /api/platform/admin/requests:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/platform/admin/approve", async (req: Request, res: Response) => {
  try {
    const telegramId = platformTelegramIdFromRequest(req);
    if (!telegramId) {
      res.status(400).json({ error: "Нужен x-telegram-id" });
      return;
    }
    if (!isPlatformAdminTelegramId(telegramId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
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
  } catch (e) {
    console.error("POST /api/platform/admin/approve:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/platform/admin/reject", async (req: Request, res: Response) => {
  try {
    const telegramId = platformTelegramIdFromRequest(req);
    if (!telegramId) {
      res.status(400).json({ error: "Нужен x-telegram-id" });
      return;
    }
    if (!isPlatformAdminTelegramId(telegramId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const requestId = Number((req.body as { requestId?: unknown }).requestId);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      res.status(400).json({ error: "Нужен корректный requestId" });
      return;
    }
    const out = await rejectRegistrationRequestById(requestId);
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
    const telegramId = platformTelegramIdFromRequest(req);
    if (!telegramId) {
      res.status(400).json({ error: "Нужен x-telegram-id" });
      return;
    }
    if (!isPlatformAdminTelegramId(telegramId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
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
    const telegramId = platformTelegramIdFromRequest(req);
    if (!telegramId) {
      res.status(400).json({ error: "Нужен x-telegram-id" });
      return;
    }
    if (!isPlatformAdminTelegramId(telegramId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
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
    res.json({
      role,
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
  res: Response
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
  return { businessId };
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
  if (businessSubscriptionBlocked(business, new Date())) {
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
      console.error("telegram-webhook:", idx, e);
      return res.sendStatus(500);
    }
  }
);

/** Старые деплои с одним ботом: тот же обработчик, что бот[0]. */
app.post("/telegram-webhook", async (req: Request, res: Response) => {
  if (!bots[0]) {
    return res.sendStatus(503);
  }
  try {
    await bots[0].handleUpdate(req.body);
    return res.sendStatus(200);
  } catch (e) {
    console.error("telegram-webhook (legacy):", e);
    return res.sendStatus(500);
  }
});

app.post("/webhook/:businessId", async (req: Request, res: Response) => {
  const businessId = Number(req.params.businessId);
  await relayDynamicTenantStoreWebhook(req, res, businessId);
});

/** Совместимость со старым URL после `setWebhook`. */
app.post(
  "/telegram-webhook/owner/:businessId",
  async (req: Request, res: Response) => {
    const businessId = Number(req.params.businessId);
    await relayDynamicTenantStoreWebhook(req, res, businessId);
  }
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
    const token = String(body.botToken ?? "").trim();
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
      where: { botToken: token, NOT: { id: businessId } },
    });
    if (conflict) {
      return res
        .status(409)
        .json({ error: "Этот бот уже подключён к другому магазину" });
    }

    await prisma.business.update({
      where: { id: businessId },
      data: { botToken: token },
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
app.get("/", (req: Request, res: Response) => {
  res.send("Server is working 🚀");
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

// ================== UPLOAD (Cloudinary, только персонал магазина) ==================
app.post(
  "/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    console.log("UPLOAD DATA:", req.body);
    const m = await requireMerchantStaff(req, res);
    if (!m) return;
    try {
      if (!isCloudinaryConfigured()) {
        return res.status(503).json({
          error: "Cloudinary не настроен (CLOUD_NAME, CLOUD_KEY, CLOUD_SECRET)",
        });
      }
      const file = req.file;
      if (!file?.buffer?.length) {
        return res.status(400).json({ error: "Нет файла" });
      }
      const url = await uploadImageToCloudinary(
        file.buffer,
        file.mimetype || "application/octet-stream"
      );
      res.json({ url });
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
    console.log("UPLOAD-IMAGES DATA:", req.body);
    const m = await requireMerchantStaff(req, res);
    if (!m) return;
    try {
      if (!isCloudinaryConfigured()) {
        return res.status(503).json({
          error: "Cloudinary не настроен (CLOUD_NAME, CLOUD_KEY, CLOUD_SECRET)",
        });
      }
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files?.length) {
        return res.status(400).json({ error: "Нет файлов" });
      }
      const urls: string[] = [];
      for (const file of files) {
        if (!file.buffer?.length) continue;
        const url = await uploadImageToCloudinary(
          file.buffer,
          file.mimetype || "application/octet-stream"
        );
        urls.push(url);
      }
      if (urls.length === 0) {
        return res.status(400).json({ error: "Пустые файлы" });
      }
      res.json({ urls });
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
    const merchant = await requireMerchantStaff(req, res);
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
    const merchant = await requireMerchantStaff(req, res);
    if (!merchant) return;
    res.json(await listPaymentDetailsFromDb(prisma, merchant.businessId));
  } catch (e) {
    console.error("PAYMENT LIST ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/payment", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res);
    if (!merchant) return;
    console.log("PAYMENT SAVE:", req.body);
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
    const merchant = await requireMerchantStaff(req, res);
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
    const merchant = await requireMerchantStaff(req, res);
    if (!merchant) return;
    res.json(await listPromosFromDb(prisma, merchant.businessId));
  } catch (e) {
    console.error("PROMO LIST ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/promo", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res);
    if (!merchant) return;
    console.log("PROMO SAVE:", req.body);
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
    const merchant = await requireMerchantStaff(req, res);
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
    });
    res.json(categories);
  } catch (e) {
    console.error("GET CATEGORIES ERROR:", e);
    res.status(500).json({ error: "Ошибка получения категорий" });
  }
});

app.post("/categories", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res);
    if (!merchant) return;
    const body = req.body as { name?: unknown };
    const name = String(body.name ?? "").trim();
    if (!name) {
      return res.status(400).json({ error: "Укажите название категории" });
    }
    const category = await prisma.category.create({
      data: { name, businessId: merchant.businessId },
    });
    res.json(category);
  } catch (e) {
    console.error("CREATE CATEGORY ERROR:", e);
    res.status(500).json({ error: "Failed to create category" });
  }
});

app.delete("/categories/:id", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res);
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

// ================== CREATE PRODUCT ==================
app.post("/products", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res);
    if (!merchant) return;
    console.log("PRODUCT CREATE DATA:", req.body);
    const body = req.body as {
      name?: unknown;
      price?: unknown;
      image?: unknown;
      images?: unknown;
      description?: unknown;
      categoryId?: unknown;
    };

    const { name, price, image, images, description, categoryId } = body;

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

    const product = await prisma.product.create({
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
      },
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
    console.log("ORDER STATUS DATA:", req.body);
    const merchant = await requireMerchantStaff(req, res);
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
    const merchant = await requireMerchantStaff(req, res);
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
    const merchant = await requireMerchantStaff(req, res);
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
    const merchant = await requireMerchantStaff(req, res);
    if (!merchant) return;

    const rawType = Array.isArray(req.query.type)
      ? req.query.type[0]
      : req.query.type;
    const type = String(rawType ?? "all").toLowerCase();

    // Исторические алиасы из UI:
    // - completed -> SHIPPED (финальный успешный статус)
    // - rejected  -> CANCELLED (отклонён/отменён)
    const baseWhere: Prisma.OrderWhereInput = {
      businessId: merchant.businessId,
    };
    let statusFilter: Prisma.EnumOrderStatusFilter | undefined;
    if (type === "completed") {
      statusFilter = { equals: "SHIPPED" };
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
    const merchant = await requireMerchantStaff(req, res);
    if (!merchant) return;
    console.log("ANALYTICS DATA:", req.body);
    const orders = await prisma.order.findMany({
      where: { businessId: merchant.businessId },
    });

    const totalOrders = orders.length;
    const totalRevenue = orders
      .filter((o) => o.status === "CONFIRMED" || o.status === "SHIPPED")
      .reduce((sum, o) => sum + o.total, 0);
    const accepted = orders.filter((o) => o.status === "ACCEPTED").length;
    const pending = orders.filter((o) => o.status === "PAID_PENDING").length;
    const shipped = orders.filter((o) => o.status === "SHIPPED").length;
    const done = shipped;

    const byStatus: Record<string, number> = {};
    for (const o of orders) {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
    }

    res.json({
      totalOrders,
      totalRevenue,
      accepted,
      pending,
      shipped,
      done,
      byStatus,
    });
  } catch (e) {
    console.error("ANALYTICS ERROR:", e);
    res.status(500).json({ error: "analytics failed" });
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

// ================== LIST ORDERS (admin, Prisma) ==================
app.get("/orders", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res);
    if (!merchant) return;
    res.json(await fetchAdminOrdersPayload(merchant.businessId));
  } catch (e) {
    console.error("LIST ORDERS ERROR:", e);
    res.status(500).json({ error: "Ошибка загрузки заказов" });
  }
});

app.post("/orders/list", async (req: Request, res: Response) => {
  try {
    const merchant = await requireMerchantStaff(req, res);
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
  businessId: number;
  customerName: string;
  phone: string;
  address: string;
  total: number;
  items: { name: string; quantity: number }[];
}): Promise<void> {
  const chatId = getNotifyTargetChatId(input.businessId);
  if (chatId == null) {
    console.log(
      "TELEGRAM ORDER NOTIFY: пропуск (нет чата: задайте CHAT_ID или /start у бота)"
    );
    return;
  }

  const message =
    `🛒 Новый заказ #${input.orderId}\n\n` +
    `👤 Имя: ${input.customerName}\n` +
    `📞 Телефон: ${input.phone}\n` +
    `📍 Адрес: ${input.address}\n\n` +
    `💰 Сумма: ${input.total} сом\n\n` +
    `📦 Товары:\n` +
    input.items.map((i) => `- ${i.name} x${i.quantity}`).join("\n");

  try {
    const tgBot = getBotForOwner(input.businessId) ?? bot;
    if (tgBot) {
      await tgBot.telegram.sendMessage(chatId, message, {
        reply_markup: adminNewOrderNotifyKeyboard(input.orderId),
      });
      console.log("TELEGRAM ORDER NOTIFY: ok", input.orderId);
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
          reply_markup: adminNewOrderNotifyKeyboard(input.orderId),
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
      console.log("TELEGRAM ORDER NOTIFY: ok", input.orderId);
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

  const rawPaymentMethod = (body as { paymentMethod?: unknown }).paymentMethod;
  const paymentMethod =
    typeof rawPaymentMethod === "string" &&
    (rawPaymentMethod === "finik" || rawPaymentMethod === "receipt")
      ? rawPaymentMethod
      : "receipt";
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

      const order = await tx.order.create({
        data: {
          businessId,
          buyerUserId: buyerUserInner.id,
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
            create: items.map((item) => ({
              businessId,
              productId: Number(item.productId),
              name: item.name,
              size: String(item.size),
              color: String(item.color),
              quantity: Number(item.quantity),
              price: Number(item.price),
            })),
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

    void notifyAdminNewOrderTelegram({
      orderId: orderForResponse.id,
      businessId: orderForResponse.businessId,
      customerName: displayName,
      phone,
      address,
      total: orderForResponse.total,
      items: orderForResponse.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
      })),
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
      const merchant = await requireMerchantStaff(req, res);
      if (!merchant) return;
      if (!isCloudinaryConfigured()) {
        return res.status(503).json({
          error: "Cloudinary не настроен (CLOUD_NAME, CLOUD_KEY, CLOUD_SECRET)",
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
    const merchant = await requireMerchantStaff(req, res);
    if (!merchant) return;
    console.log("PRODUCT UPDATE DATA:", req.body);
    const body = req.body as {
      name?: unknown;
      price?: unknown;
      image?: unknown;
      images?: unknown;
      description?: unknown;
      categoryId?: unknown;
    };

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }

    const { name, price, image, images, description, categoryId } = body;

    if (
      name === undefined &&
      price === undefined &&
      image === undefined &&
      images === undefined &&
      description === undefined &&
      categoryId === undefined
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

    const exists = await prisma.product.findUnique({ where: { id } });
    if (!exists || exists.businessId !== merchant.businessId) {
      return res.status(404).json({ error: "Товар не найден" });
    }

    const product = await prisma.product.update({
      where: { id },
      data: scalar,
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
    const merchant = await requireMerchantStaff(req, res);
    if (!merchant) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }

    const exists = await prisma.product.findUnique({ where: { id } });
    if (!exists || exists.businessId !== merchant.businessId) {
      return res.status(404).json({ error: "Товар не найден" });
    }

    await prisma.product.delete({ where: { id } });

    res.status(204).send();
  } catch (e) {
    console.error("DELETE PRODUCT ERROR:", e);
    res.status(500).json({ error: "Ошибка удаления товара" });
  }
});

// ================== GLOBAL PROCESS ERRORS ==================
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT ERROR:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED PROMISE:", reason);
});

// ================== START SERVER ==================
const PORT = process.env.PORT || 3000;

void (async () => {
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
        void bots[i]!.telegram
          .setWebhook(url)
          .then(() => console.log("Webhook set:", url))
          .catch((err) => console.error("Webhook error:", i, err));
      }
    } else if (bots.length > 0) {
      console.log(
        "API_URL not set — skipping setWebhook (set API_URL for production; path /telegram-webhook/{index})"
      );
    }
    try {
      await startAllBots();
      console.log("[botManager] Dynamic store bots registered from database");
    } catch (e) {
      console.error("startAllBots:", e);
    }
    try {
      startSubscriptionMaintenanceScheduler();
    } catch (e) {
      console.error("startSubscriptionMaintenanceScheduler:", e);
    }
  });
})();