import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { Prisma, UserRole } from "@prisma/client";
import cors from "cors";
import {
  isCloudinaryConfigured,
  uploadImageToCloudinary,
  uploadReceiptToCloudinary,
} from "./cloudinary.js";
import { adminUserIdFromRequest, isAdmin } from "./adminAuth.js";
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
  getDynamicOwnerBot,
  getNotifyTargetChatId,
  initDynamicUserBotsFromDatabase,
  registerDynamicUserBot,
} from "../bot/bot.js";
import { prisma } from "./db.js";
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
import { startSubscriptionMaintenanceScheduler } from "./subscriptionMaintenance.js";
import { cleanInput, validateKgPhone } from "./orderInputSanitize.js";
import { businessMiddleware } from "../middleware/business.middleware.js";

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

app.use("/api", businessMiddleware);

app.get("/api/me", (_req: Request, res: Response) => {
  res.json({
    businessId: _req.businessId ?? null,
    telegramId: _req.tenantUser?.telegramId ?? null,
    businessName: _req.tenantBusiness?.name ?? null,
  });
});

function telegramIdFromRequest(req: Request): string | null {
  const rawBody = (req.body as { userId?: unknown } | undefined)?.userId;
  const rawQuery = req.query.userId;
  const raw = rawBody ?? (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery);
  if (raw === undefined || raw === null) return null;
  const telegramId = String(raw).trim();
  return telegramId ? telegramId : null;
}

/** Витрина: `shop`, `body.businessId` или `x-business-id` = id Business (тенанта). */
function businessIdFromNonApiHint(req: Request): number | null {
  const rawH = req.headers["x-business-id"];
  const hdr =
    typeof rawH === "string"
      ? rawH
      : Array.isArray(rawH)
        ? rawH[0]
        : "";
  const fromHeader = hdr ? Number(String(hdr).trim()) : NaN;
  if (Number.isInteger(fromHeader) && fromHeader > 0) return fromHeader;

  const shopRaw = req.query.shop;
  const qs =
    typeof shopRaw === "string"
      ? shopRaw
      : Array.isArray(shopRaw)
        ? String(shopRaw[0] ?? "")
        : "";
  const shop = Number(qs.trim());
  if (Number.isInteger(shop) && shop > 0) return shop;

  const body = req.body as { businessId?: unknown } | undefined;
  const b = body?.businessId;
  if (typeof b === "number" && Number.isInteger(b) && b > 0) return b;
  if (typeof b === "string") {
    const n = Number(b.trim());
    if (Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

async function requireMerchantStaff(
  req: Request,
  res: Response
): Promise<
  import("@prisma/client").User | null
> {
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
  const user = await prisma.user.findUnique({
    where: { businessId_telegramId: { businessId, telegramId } },
  });
  if (
    !user ||
    (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN)
  ) {
    res.status(403).json({ error: "Нет доступа к этому магазину" });
    return null;
  }
  return user;
}

async function resolveCatalogBusinessId(
  req: Request,
  res: Response
): Promise<number | null> {
  const businessId = businessIdFromNonApiHint(req);
  if (businessId == null) {
    res.status(400).json({ error: "Укажите магазин (shop=id бизнеса)" });
    return null;
  }
  const exists = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true },
  });
  if (!exists) {
    res.status(400).json({ error: "Магазин не найден" });
    return null;
  }
  return businessId;
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
  return tx.user.upsert({
    where: { businessId_telegramId: { businessId, telegramId } },
    create: {
      businessId,
      telegramId,
      name: normalizedName,
      role: UserRole.STAFF,
    },
    update: normalizedName != null ? { name: normalizedName } : {},
  });
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

/** Клиентский бот (токен из `User.botToken`). */
app.post(
  "/telegram-webhook/owner/:ownerId",
  async (req: Request, res: Response) => {
    const ownerId = Number(req.params.ownerId);
    if (!Number.isInteger(ownerId) || ownerId <= 0) {
      return res.sendStatus(400);
    }
    const tBot = getDynamicOwnerBot(ownerId);
    if (!tBot) {
      return res.sendStatus(404);
    }
    try {
      await tBot.handleUpdate(req.body);
      return res.sendStatus(200);
    } catch (e) {
      console.error("telegram-webhook/owner:", ownerId, e);
      return res.sendStatus(500);
    }
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
    const merchant = await prisma.user.findFirst({
      where: {
        businessId,
        telegramId,
        role: { in: [UserRole.OWNER, UserRole.ADMIN] },
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

    await registerDynamicUserBot({ businessId, botToken: token });

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
app.post("/check-admin", (req: Request, res: Response) => {
  res.json({ isAdmin: isAdmin(adminUserIdFromRequest(req)) });
});

// ================== UPLOAD (Cloudinary, админ магазина или платформы) ==================
app.post(
  "/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    console.log("UPLOAD DATA:", req.body);
    const platform = isAdmin(adminUserIdFromRequest(req));
    if (!platform) {
      const m = await requireMerchantStaff(req, res);
      if (!m) return;
    }
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
    const platform = isAdmin(adminUserIdFromRequest(req));
    if (!platform) {
      const m = await requireMerchantStaff(req, res);
      if (!m) return;
    }
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
    const businessId = Number(bid);
    const t = Number(total);
    if (
      code == null ||
      String(code).trim() === "" ||
      !Number.isFinite(t) ||
      !Number.isInteger(businessId) ||
      businessId <= 0
    ) {
      return res.status(400).json({ error: "Нужны businessId, code и total" });
    }
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
    const businessId = businessIdFromNonApiHint(req);
    if (businessId == null) {
      return res
        .status(400)
        .json({ error: "Укажите магазин (shop / x-business-id / body.businessId)" });
    }

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
      await initDynamicUserBotsFromDatabase();
    } catch (e) {
      console.error("initDynamicUserBotsFromDatabase:", e);
    }
    try {
      startSubscriptionMaintenanceScheduler();
    } catch (e) {
      console.error("startSubscriptionMaintenanceScheduler:", e);
    }
  });
})();