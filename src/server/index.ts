import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { Prisma } from "@prisma/client";
import cors from "cors";
import {
  isCloudinaryConfigured,
  uploadImageToCloudinary,
  uploadReceiptToCloudinary,
} from "./cloudinary.js";
import {
  adminUserIdFromRequest,
  denyIfNotAdmin,
  denyIfNotAdminQuery,
  isAdmin,
} from "./adminAuth.js";
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
  expandShortHex,
  isValidHexColor,
  lookupVariantHexByName,
} from "../shared/variantColorPresets.js";
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
import { cleanInput, validateKgPhone } from "./orderInputSanitize.js";

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
  body: OrderTotalBody
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
      const applied = await tryApplyPromoDb(prisma, promoRaw, subtotalVal);
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

type CleanVariantInput = {
  color: string;
  colorHex: string | null;
  sizes: { size: string; stock: number }[];
};

function parseVariantColorInput(
  raw: unknown,
  index: number
): { name: string; hex: string | null } | { error: string } {
  const n = index + 1;
  if (raw == null || raw === "") {
    return { error: `Вариант ${n}: укажите цвет` };
  }
  if (typeof raw === "string") {
    const name = raw.trim();
    if (!name) {
      return { error: `Вариант ${n}: укажите название цвета` };
    }
    return { name, hex: lookupVariantHexByName(name) };
  }
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const name = String(o.name ?? "").trim();
    if (!name) {
      return { error: `Вариант ${n}: укажите название цвета` };
    }
    let hex: string | null = null;
    const hexRaw = o.hex;
    if (typeof hexRaw === "string" && hexRaw.trim() !== "") {
      const h = expandShortHex(hexRaw.trim());
      if (!isValidHexColor(h)) {
        return { error: `Вариант ${n}: неверный HEX` };
      }
      hex = expandShortHex(h);
    }
    if (!hex) {
      hex = lookupVariantHexByName(name);
    }
    return { name, hex };
  }
  return { error: `Вариант ${n}: неверный формат цвета` };
}

function clampDiscountPercent(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, Math.round(v)));
}

function parseVariantSizes(
  sizesRaw: unknown,
  variantIndex: number
): { size: string; stock: number }[] | { error: string } {
  const sizes: { size: string; stock: number }[] = [];

  if (Array.isArray(sizesRaw)) {
    if (sizesRaw.length === 0) {
      return { error: `Вариант ${variantIndex + 1}: нужны размеры` };
    }
    for (const s of sizesRaw) {
      const z = s as { size?: unknown; stock?: unknown };
      const size = String(z?.size ?? "").trim();
      const stock = Number(z?.stock);
      if (!size || !Number.isFinite(stock) || stock < 0) {
        return {
          error: `Вариант ${variantIndex + 1}: неверные размер или количество`,
        };
      }
      if (stock > 0) {
        sizes.push({ size, stock: Math.round(stock) });
      }
    }
  } else if (sizesRaw != null && typeof sizesRaw === "object") {
    for (const [key, val] of Object.entries(sizesRaw as Record<string, unknown>)) {
      const size = String(key ?? "").trim();
      const stock = Number(val);
      if (!size || !Number.isFinite(stock) || stock < 0) {
        return {
          error: `Вариант ${variantIndex + 1}: неверные размер или количество`,
        };
      }
      if (stock > 0) {
        sizes.push({ size, stock: Math.round(stock) });
      }
    }
  } else {
    return { error: `Вариант ${variantIndex + 1}: нужны размеры` };
  }

  if (sizes.length === 0) {
    return {
      error: `Вариант ${variantIndex + 1}: укажите остаток хотя бы для одного размера`,
    };
  }
  return sizes;
}

function normalizeVariantsInput(
  raw: unknown
): CleanVariantInput[] | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "Нужен хотя бы один вариант" };
  }
  const out: CleanVariantInput[] = [];
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i] as { color?: unknown; sizes?: unknown };
    const col = parseVariantColorInput(v?.color, i);
    if ("error" in col) {
      return { error: col.error };
    }
    const parsed = parseVariantSizes(v?.sizes, i);
    if ("error" in parsed) {
      return { error: parsed.error };
    }
    out.push({ color: col.name, colorHex: col.hex, sizes: parsed });
  }
  return out;
}

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

function telegramIdFromRequest(req: Request): string | null {
  const rawBody = (req.body as { userId?: unknown } | undefined)?.userId;
  const rawQuery = req.query.userId;
  const raw = rawBody ?? (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery);
  if (raw === undefined || raw === null) return null;
  const telegramId = String(raw).trim();
  return telegramId ? telegramId : null;
}

async function getOrCreateOwnerByTelegram(
  tx: typeof prisma,
  telegramId: string,
  fallbackName?: string | null
) {
  const normalizedName = String(fallbackName ?? "").trim() || null;
  const existing = await tx.user.findUnique({ where: { telegramId } });
  if (existing) {
    if (!existing.name && normalizedName) {
      return tx.user.update({
        where: { id: existing.id },
        data: { name: normalizedName },
      });
    }
    return existing;
  }
  return tx.user.create({
    data: {
      telegramId,
      name: normalizedName,
    },
  });
}

async function requireOwner(req: Request, res: Response) {
  const telegramId = telegramIdFromRequest(req);
  if (!telegramId) {
    res.status(400).json({ error: "Нужен userId (Telegram)" });
    return null;
  }
  return getOrCreateOwnerByTelegram(prisma, telegramId);
}

/** `?shop=123` — id владельца витрины; иначе владелец = пользователь `userId` (Telegram). */
function shopIdFromRequest(req: Request): number | null {
  const raw = req.query.shop;
  const q = Array.isArray(raw) ? raw[0] : raw;
  if (q === undefined || q === null || String(q).trim() === "") return null;
  const n = Number(q);
  if (Number.isInteger(n) && n > 0) return n;
  return null;
}

/** Публичная витрина: владелец магазина либо из `shop`, либо (админ) из `userId`. */
async function resolveStoreTenant(
  req: Request,
  res: Response
) {
  const shop = shopIdFromRequest(req);
  if (shop != null) {
    const u = await prisma.user.findUnique({ where: { id: shop } });
    if (!u) {
      res.status(400).json({ error: "Магазин не найден" });
      return null;
    }
    return u;
  }
  return requireOwner(req, res);
}

function trimTrailingSlash(u: string): string {
  return u.replace(/\/$/, "");
}

const publicApiBase = process.env.API_URL?.trim()
  ? trimTrailingSlash(process.env.API_URL.trim())
  : "";

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
    const token = String(
      (req.body as { botToken?: unknown })?.botToken ?? ""
    ).trim();
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

    const user = await getOrCreateOwnerByTelegram(prisma, telegramId);
    const conflict = await prisma.user.findFirst({
      where: { botToken: token, id: { not: user.id } },
    });
    if (conflict) {
      return res
        .status(409)
        .json({ error: "Этот бот уже подключён к другому магазину" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { botToken: token },
    });

    await registerDynamicUserBot({ id: user.id, botToken: token });

    return res.json({
      ok: true,
      shopId: user.id,
      botUsername: meJson.result.username ?? "",
    });
  } catch (e) {
    console.error("connect-bot:", e);
    return res.status(500).json({ error: "Не удалось подключить бота" });
  }
});

/** Finik (и др.): подтверждение оплаты без чека. Тело: `{ paymentId, status }` или аналоги. */
app.post("/finik/webhook", async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const paymentIdRaw =
      body.paymentId ?? body.payment_id ?? body.orderId ?? body.order_id;
    const statusRaw = body.status ?? body.payment_status ?? body.state;
    const paymentId =
      paymentIdRaw != null && String(paymentIdRaw).trim() !== ""
        ? String(paymentIdRaw).trim()
        : "";
    const status = String(statusRaw ?? "").toLowerCase();

    if (!paymentId) {
      return res.status(400).json({ error: "paymentId required" });
    }

    const successStatuses = new Set([
      "success",
      "paid",
      "completed",
      "succeeded",
    ]);
    if (!successStatuses.has(status)) {
      return res.json({ ok: true, ignored: true });
    }

    const order = await prisma.order.findFirst({
      where: { paymentId },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (String(order.paymentMethod ?? "").toLowerCase() !== "finik") {
      return res.status(400).json({ error: "Not a Finik order" });
    }

    const cur = String(order.status ?? "").toUpperCase();
    if (cur === "CONFIRMED" || cur === "SHIPPED") {
      return res.json({ ok: true, duplicate: true });
    }
    if (cur === "CANCELLED") {
      return res.status(400).json({ error: "Order cancelled" });
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: "CONFIRMED" },
      include: { user: true },
    });

    void notifyAfterOrderStatusChangeFromApi({
      id: updated.id,
      ownerId: updated.ownerId,
      status: updated.status,
      total: updated.total,
      user: { telegramId: updated.user.telegramId },
      paymentMethod: updated.paymentMethod,
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("FINIK WEBHOOK:", e);
    return res.status(500).json({ error: "Webhook error" });
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

// ================== UPLOAD (Cloudinary, admin) ==================
app.post(
  "/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    console.log("UPLOAD DATA:", req.body);
    if (!denyIfNotAdmin(req, res)) return;
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
    if (!denyIfNotAdmin(req, res)) return;
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

// ================== PAYMENT (Prisma singleton id=1) ==================
app.get("/settings", async (req: Request, res: Response) => {
  try {
    const owner = await resolveStoreTenant(req, res);
    if (!owner) return;
    let settings = await prisma.paymentSettings.findUnique({
      where: { ownerId: owner.id },
    });
    if (!settings) {
      settings = await prisma.paymentSettings.create({
        data: { ownerId: owner.id },
      });
    }
    // `other` — совместимый алиас для клиентов, ожидающих это поле.
    return res.json({
      ...settings,
      other: settings.obank,
    });
  } catch (e) {
    console.error("GET /settings ERROR:", e);
    return res.status(500).json({ error: "Failed to load settings" });
  }
});

app.post("/settings", async (req: Request, res: Response) => {
  if (!denyIfNotAdmin(req, res)) return;
  try {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    const body = req.body as Record<string, unknown>;
    const data = {
      mbank: body.mbank,
      optima: body.optima,
      // Поддерживаем `other` как алиас `obank`.
      obank: body.obank ?? body.other,
      card: body.card,
      qr: body.qr,
    } as Record<string, unknown>;
    const settings = await upsertPaymentSettings(prisma, owner.id, data);
    return res.json({
      ...settings,
      other: settings.obank,
    });
  } catch (e) {
    console.error("POST /settings ERROR:", e);
    return res.status(500).json({ error: "Failed to save settings" });
  }
});

app.post("/payment/list", async (req: Request, res: Response) => {
  if (!denyIfNotAdmin(req, res)) return;
  try {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    res.json(await listPaymentDetailsFromDb(prisma, owner.id));
  } catch (e) {
    console.error("PAYMENT LIST ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/payment", async (req: Request, res: Response) => {
  if (!denyIfNotAdmin(req, res)) return;
  try {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    console.log("PAYMENT SAVE:", req.body);
    const saved = await upsertPaymentSettings(
      prisma,
      owner.id,
      req.body as Record<string, unknown>
    );
    res.json(saved);
  } catch (e) {
    console.error("PAYMENT ERROR:", e);
    res.status(500).json({ error: "Failed to save payment" });
  }
});

app.delete("/payment/:id", async (req: Request, res: Response) => {
  if (!denyIfNotAdmin(req, res)) return;
  try {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }

    const ok = await clearPaymentFieldByRowId(prisma, owner.id, id);
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
    const { code, total } = req.body as { code?: unknown; total?: unknown };
    const t = Number(total);
    if (code == null || String(code).trim() === "" || !Number.isFinite(t)) {
      return res.status(400).json({ error: "Нужны code и total" });
    }
    try {
      const result = await tryApplyPromoDb(prisma, String(code), t);
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
  if (!denyIfNotAdmin(req, res)) return;
  try {
    res.json(await listPromosFromDb(prisma));
  } catch (e) {
    console.error("PROMO LIST ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/promo", async (req: Request, res: Response) => {
  if (!denyIfNotAdmin(req, res)) return;
  try {
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
  if (!denyIfNotAdmin(req, res)) return;
  try {
    const codeParam = req.params.code;
    const encoded =
      typeof codeParam === "string"
        ? codeParam
        : Array.isArray(codeParam)
          ? (codeParam[0] ?? "")
          : "";
    const raw = decodeURIComponent(encoded);
    const ok = await deletePromoByCodeDb(prisma, raw);
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
    const owner = await resolveStoreTenant(_req, res);
    if (!owner) return;
    const categories = await prisma.category.findMany({
      where: { ownerId: owner.id },
      include: { children: true },
      orderBy: [{ parentId: "asc" }, { id: "asc" }],
    });
    res.json(categories);
  } catch (e) {
    console.error("GET CATEGORIES ERROR:", e);
    res.status(500).json({ error: "Ошибка получения категорий" });
  }
});

app.post("/categories", async (req: Request, res: Response) => {
  try {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    const body = req.body as { name?: unknown; parentId?: unknown };
    const name = String(body.name ?? "").trim();
    if (!name) {
      return res.status(400).json({ error: "Укажите название категории" });
    }
    const parentIdRaw = body.parentId;
    const parentId =
      parentIdRaw === undefined || parentIdRaw === null || parentIdRaw === ""
        ? null
        : Number(parentIdRaw);
    const category = await prisma.category.create({
      data: { name, parentId, ownerId: owner.id },
    });
    res.json(category);
  } catch (e) {
    console.error("CREATE CATEGORY ERROR:", e);
    res.status(500).json({ error: "Failed to create category" });
  }
});

app.delete("/categories/:id", async (req: Request, res: Response) => {
  if (!denyIfNotAdminQuery(req, res)) return;
  try {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }
    const row = await prisma.category.findUnique({
      where: { id },
      include: {
        children: { select: { id: true } },
        _count: { select: { products: true } },
      },
    });
    if (!row) {
      return res.status(404).json({ error: "Категория не найдена" });
    }
    if (row.ownerId !== owner.id) {
      return res.status(404).json({ error: "Категория не найдена" });
    }
    if (row.children.length > 0) {
      return res.status(400).json({ error: "Удалите сначала подкатегории" });
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
  if (!denyIfNotAdmin(req, res)) return;
  try {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    console.log("PRODUCT CREATE DATA:", req.body);
    const body = req.body as {
      name?: unknown;
      price?: unknown;
      image?: unknown;
      images?: unknown;
      description?: unknown;
      categoryId?: unknown;
      isNew?: unknown;
      isPopular?: unknown;
      isSale?: unknown;
      discountPercent?: unknown;
      variants?: unknown;
    };

    const {
      name,
      price,
      image,
      images,
      description,
      categoryId,
      isNew,
      isPopular,
      isSale,
      discountPercent,
      variants,
    } =
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

    const cleanVariants = normalizeVariantsInput(variants);
    if ("error" in cleanVariants) {
      return res.status(400).json({ error: cleanVariants.error });
    }

    if (!name || price == null || !primaryImage) {
      return res.status(400).json({ error: "Неверные данные" });
    }
    const normalizedCategoryId = Number(categoryId);
    if (!Number.isFinite(normalizedCategoryId)) {
      return res.status(400).json({ error: "Нужна подкатегория" });
    }
    const category = await prisma.category.findUnique({
      where: { id: normalizedCategoryId },
      select: { id: true, parentId: true, ownerId: true },
    });
    if (!category || category.parentId == null || category.ownerId !== owner.id) {
      return res.status(400).json({ error: "Выберите подкатегорию" });
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
        isNew: Boolean(isNew),
        isPopular: Boolean(isPopular),
        isSale: Boolean(isSale),
        discountPercent: clampDiscountPercent(discountPercent),
        ownerId: owner.id,
        variants: {
          create: cleanVariants.map((v) => ({
            color: v.color,
            colorHex: v.colorHex,
            sizes: {
              create: v.sizes.map((s) => ({
                size: s.size,
                stock: s.stock,
              })),
            },
          })),
        },
      },
      include: {
        category: {
          include: { parent: true },
        },
        variants: {
          include: {
            sizes: true,
          },
        },
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
  ownerId: number,
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
      include: { user: true },
    });
    if (!existing || existing.ownerId !== ownerId) {
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
      include: { user: true },
    });
    void notifyAfterOrderStatusChangeFromApi({
      id: updated.id,
      ownerId: updated.ownerId,
      status: updated.status,
      total: updated.total,
      user: { telegramId: updated.user.telegramId },
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
    if (!denyIfNotAdmin(req, res)) return;
    const owner = await requireOwner(req, res);
    if (!owner) return;

    const { id, status } = req.body as {
      id?: unknown;
      status?: unknown;
    };

    const orderId = Number(id);
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ error: "Нужен id" });
    }

    const result = await performOrderStatusUpdate(orderId, owner.id, status);
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
    if (!denyIfNotAdmin(req, res)) return;
    const owner = await requireOwner(req, res);
    if (!owner) return;
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ error: "Неверный id" });
    }
    const { status } = req.body as { status?: unknown };
    const result = await performOrderStatusUpdate(orderId, owner.id, status);
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
    if (!denyIfNotAdmin(req, res)) return;
    const owner = await requireOwner(req, res);
    if (!owner) return;
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
    if (!exists || exists.ownerId !== owner.id) {
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
      include: { user: true },
    });

    if (
      hasStatus &&
      data.status !== undefined &&
      exists.status !== data.status
    ) {
      void notifyAfterOrderStatusChangeFromApi({
        id: updated.id,
        ownerId: updated.ownerId,
        status: updated.status,
        total: updated.total,
        user: { telegramId: updated.user.telegramId },
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
    if (!denyIfNotAdmin(req, res)) return;
    const owner = await requireOwner(req, res);
    if (!owner) return;

    const rawType = Array.isArray(req.query.type)
      ? req.query.type[0]
      : req.query.type;
    const type = String(rawType ?? "all").toLowerCase();

    // Исторические алиасы из UI:
    // - completed -> SHIPPED (финальный успешный статус)
    // - rejected  -> CANCELLED (отклонён/отменён)
    let where: { status?: string } = {};
    if (type === "completed") {
      where.status = "SHIPPED";
    } else if (type === "rejected") {
      where.status = "CANCELLED";
    } else if (type === "all") {
      where = {};
    } else {
      return res.status(400).json({ error: "Unsupported clear type" });
    }

    const deleted = await prisma.order.deleteMany({
      where: { ...where, ownerId: owner.id },
    });
    return res.json({ deleted: deleted.count });
  } catch (e) {
    console.error("DELETE /orders/clear:", e);
    return res.status(500).json({ error: "Clear failed" });
  }
});

app.post("/analytics", async (req: Request, res: Response) => {
  if (!denyIfNotAdmin(req, res)) return;
  try {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    console.log("ANALYTICS DATA:", req.body);
    const orders = await prisma.order.findMany({
      where: { ownerId: owner.id },
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
    const owner = await resolveStoreTenant(req, res);
    if (!owner) return;
    const products = await prisma.product.findMany({
      where: { ownerId: owner.id },
      include: {
        category: { include: { parent: true } },
        variants: {
          include: {
            sizes: true,
          },
        },
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
    const owner = await resolveStoreTenant(req, res);
    if (!owner) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: { include: { parent: true } },
        variants: {
          include: { sizes: true },
        },
      },
    });
    if (!product) {
      return res.status(404).json({ error: "Товар не найден" });
    }
    if (product.ownerId !== owner.id) {
      return res.status(404).json({ error: "Товар не найден" });
    }
    res.json(product);
  } catch (error) {
    console.error("GET PRODUCT ERROR:", error);
    res.status(500).json({ error: "Ошибка получения товара" });
  }
});

async function fetchAdminOrdersPayload(ownerId: number) {
  const rows = await prisma.order.findMany({
    where: { ownerId },
    include: { user: true },
    orderBy: { id: "desc" },
  });
  return rows.map((o) => {
    const phone =
      (o as { customerPhone?: string | null }).customerPhone?.trim() || "—";
    const tracking =
      (o as { tracking?: string | null }).tracking?.trim() || null;
    const receiptUrl =
      (o as { receiptUrl?: string | null }).receiptUrl?.trim() || null;
    const receiptType =
      (o as { receiptType?: string | null }).receiptType?.trim() || null;
    const paymentMethod =
      (o as { paymentMethod?: string | null }).paymentMethod?.trim() ||
      "receipt";
    const address =
      typeof o.address === "string" && o.address.trim() !== ""
        ? o.address.trim()
        : null;
    const lat =
      o.lat != null && Number.isFinite(Number(o.lat)) ? Number(o.lat) : null;
    const lng =
      o.lng != null && Number.isFinite(Number(o.lng)) ? Number(o.lng) : null;
    return {
      id: o.id,
      name: o.user.name?.trim() || "Гость",
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

    const user = await getOrCreateOwnerByTelegram(prisma, telegramId);

    const orders = await prisma.order.findMany({
      where: { userId: user.id },
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
  if (!denyIfNotAdminQuery(req, res)) return;
  try {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    res.json(await fetchAdminOrdersPayload(owner.id));
  } catch (e) {
    console.error("LIST ORDERS ERROR:", e);
    res.status(500).json({ error: "Ошибка загрузки заказов" });
  }
});

app.post("/orders/list", async (req: Request, res: Response) => {
  if (!denyIfNotAdmin(req, res)) return;
  try {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    res.json(await fetchAdminOrdersPayload(owner.id));
  } catch (e) {
    console.error("LIST ORDERS ERROR:", e);
    res.status(500).json({ error: "Ошибка загрузки заказов" });
  }
});

/** Уведомление админу в Telegram о новом заказе из POST /orders (Prisma). */
async function notifyAdminNewOrderTelegram(input: {
  orderId: number;
  ownerId: number;
  customerName: string;
  phone: string;
  address: string;
  total: number;
  items: { name: string; quantity: number }[];
}): Promise<void> {
  const chatId = getNotifyTargetChatId(input.ownerId);
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
    const tgBot = getBotForOwner(input.ownerId) ?? bot;
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

/** Мок Finik: заменить на HTTP-запрос к API и вернуть реальные `paymentId` + `paymentUrl`. */
function createFinikPaymentMock(input: {
  orderId: number;
  amount: number;
}): { paymentId: string; paymentUrl: string } {
  const paymentId = `finik_${Date.now()}_${input.orderId}`;
  const paymentUrl = `https://pay.finik.kg/?amount=${input.amount}&orderId=${encodeURIComponent(paymentId)}`;
  return { paymentId, paymentUrl };
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

  const totalComputed = await computeOrderTotalFromBody(body);
  if (!totalComputed.ok) {
    return res.status(400).json({ error: totalComputed.error });
  }
  const orderTotal = totalComputed.orderTotal;

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

  try {
    const { order, user } = await prisma.$transaction(async (tx) => {
      const telegramId = String(body.user.telegramId ?? "").trim();
      if (!telegramId) {
        throw new Error("BAD_TELEGRAM_ID");
      }
      const user = await getOrCreateOwnerByTelegram(
        tx as typeof prisma,
        telegramId,
        userNameSanitized || null
      );

      const firstProduct = await tx.product.findUnique({
        where: { id: items[0]!.productId },
        select: { id: true, ownerId: true },
      });
      if (!firstProduct) {
        throw new Error("NOT_FOUND");
      }
      const storeOwnerId = firstProduct.ownerId;

      for (const item of items) {
        const productId = Number(item.productId);
        const qty = Number(item.quantity);
        if (!productId || Number.isNaN(qty) || qty < 1) {
          throw new Error("INVALID_ITEM");
        }

        const p = await tx.product.findUnique({
          where: { id: productId },
          select: { ownerId: true },
        });
        if (!p || p.ownerId !== storeOwnerId) {
          throw new Error("CROSS_SHOP_CART");
        }

        const sizeRow = await tx.size.findFirst({
          where: {
            size: String(item.size),
            variant: {
              productId,
              color: String(item.color),
              product: { ownerId: storeOwnerId },
            },
          },
        });

        if (!sizeRow) {
          throw new Error("NOT_FOUND");
        }

        const updated = await tx.size.updateMany({
          where: {
            id: sizeRow.id,
            stock: { gte: qty },
          },
          data: { stock: { decrement: qty } },
        });

        if (updated.count !== 1) {
          throw new Error("OUT_OF_STOCK");
        }

        await tx.$executeRaw(
          Prisma.sql`UPDATE "Product" SET "sold" = "sold" + ${qty} WHERE "id" = ${productId} AND "ownerId" = ${storeOwnerId}`
        );
      }

      const order = await tx.order.create({
        data: {
          userId: user.id,
          ownerId: storeOwnerId,
          total: orderTotal,
          status: "NEW",
          customerPhone: customerPhoneValue,
          address: orderAddress,
          lat: orderLat,
          lng: orderLng,
          paymentMethod,
          /** Finik: id выставится после создания (мок или реальный API). */
          paymentId: paymentMethod === "finik" ? null : paymentId,
          items: {
            create: items.map((item) => ({
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

      return { order, user };
    });

    console.log("ORDER CREATED:", order);

    let paymentUrl: string | null = null;
    let orderForResponse = order;

    if (paymentMethod === "finik") {
      const finik = createFinikPaymentMock({
        orderId: order.id,
        amount: order.total,
      });
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
      user.name?.trim() || userNameSanitized || "Гость";
    const phone =
      orderForResponse.customerPhone?.trim() || customerPhoneValue || "—";

    void notifyAdminNewOrderTelegram({
      orderId: orderForResponse.id,
      ownerId: orderForResponse.ownerId,
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
        await consumePromoDb(prisma, totalComputed.promoRaw);
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
    if (code === "NOT_FOUND") {
      return res
        .status(400)
        .json({ error: "Товар недоступен (цвет или размер не найден)" });
    }
    if (code === "OUT_OF_STOCK") {
      return res.status(400).json({ error: "Недостаточно товара на складе" });
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
      const owner = await requireOwner(req, res);
      if (!owner) return;
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
      if (!existing || existing.ownerId !== owner.id) {
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
        include: { items: true, user: true },
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
  if (!denyIfNotAdmin(req, res)) return;
  try {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    console.log("PRODUCT UPDATE DATA:", req.body);
    const body = req.body as {
      name?: unknown;
      price?: unknown;
      image?: unknown;
      images?: unknown;
      description?: unknown;
      categoryId?: unknown;
      isNew?: unknown;
      isPopular?: unknown;
      isSale?: unknown;
      discountPercent?: unknown;
      variants?: unknown;
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
      description,
      categoryId,
      isNew,
      isPopular,
      isSale,
      discountPercent,
      variants,
    } = body;

    const hasVariantUpdate = variants !== undefined;
    if (
      name === undefined &&
      price === undefined &&
      image === undefined &&
      images === undefined &&
      description === undefined &&
      categoryId === undefined &&
      isNew === undefined &&
      isPopular === undefined &&
      isSale === undefined &&
      discountPercent === undefined &&
      !hasVariantUpdate
    ) {
      return res.status(400).json({ error: "Нет полей для обновления" });
    }

    let cleanVariants: CleanVariantInput[] | undefined;
    if (hasVariantUpdate) {
      const parsed = normalizeVariantsInput(variants);
      if ("error" in parsed) {
        return res.status(400).json({ error: parsed.error });
      }
      cleanVariants = parsed;
    }

    const scalar: {
      name?: string;
      price?: number;
      image?: string;
      images?: string[];
      description?: string | null;
      categoryId?: number;
      isNew?: boolean;
      isPopular?: boolean;
      isSale?: boolean;
      discountPercent?: number;
    } = {};

    if (name !== undefined) scalar.name = String(name);
    if (price !== undefined) scalar.price = Number(price);
    if (discountPercent !== undefined) {
      scalar.discountPercent = clampDiscountPercent(discountPercent);
    }
    if (categoryId !== undefined) {
      const normalizedCategoryId = Number(categoryId);
      if (!Number.isFinite(normalizedCategoryId)) {
        return res.status(400).json({ error: "Неверная категория" });
      }
      const category = await prisma.category.findUnique({
        where: { id: normalizedCategoryId },
        select: { id: true, parentId: true, ownerId: true },
      });
      if (!category || category.parentId == null || category.ownerId !== owner.id) {
        return res.status(400).json({ error: "Выберите подкатегорию" });
      }
      scalar.categoryId = normalizedCategoryId;
    }
    if (isNew !== undefined) scalar.isNew = Boolean(isNew);
    if (isPopular !== undefined) scalar.isPopular = Boolean(isPopular);
    if (isSale !== undefined) scalar.isSale = Boolean(isSale);
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

    const product = await prisma.$transaction(async (tx) => {
      const exists = await tx.product.findUnique({ where: { id } });
      if (!exists || exists.ownerId !== owner.id) {
        throw new Error("PRODUCT_NOT_FOUND");
      }
      if (cleanVariants) {
        await tx.size.deleteMany({
          where: { variant: { productId: id } },
        });
        await tx.variant.deleteMany({ where: { productId: id } });
        for (const v of cleanVariants) {
          const variantData = {
            productId: id,
            color: v.color,
            colorHex: v.colorHex,
            sizes: {
              create: v.sizes.map((s) => ({
                size: s.size,
                stock: s.stock,
              })),
            },
          };
          await tx.variant.create({
            data: variantData as Prisma.VariantUncheckedCreateInput,
          });
        }
      }

      const include = {
        category: { include: { parent: true } },
        variants: { include: { sizes: true } },
      };
      if (Object.keys(scalar).length > 0) {
        return tx.product.update({
          where: { id },
          data: scalar,
          include,
        });
      }
      return tx.product.findUniqueOrThrow({
        where: { id },
        include,
      });
    });

    res.json(product);
  } catch (e) {
    if (e instanceof Error && e.message === "PRODUCT_NOT_FOUND") {
      return res.status(404).json({ error: "Товар не найден" });
    }
    console.error("UPDATE PRODUCT ERROR:", e);
    res.status(500).json({ error: "Ошибка обновления товара" });
  }
});

// ================== DELETE PRODUCT ==================
app.delete("/products/:id", async (req: Request, res: Response) => {
  if (!denyIfNotAdmin(req, res)) return;
  try {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }

    await prisma.$transaction(async (tx) => {
      const exists = await tx.product.findUnique({ where: { id } });
      if (!exists || exists.ownerId !== owner.id) {
        throw new Error("PRODUCT_NOT_FOUND");
      }
      const variants = await tx.variant.findMany({
        where: { productId: id },
        select: { id: true },
      });
      const variantIds = variants.map((v) => v.id);
      if (variantIds.length > 0) {
        await tx.size.deleteMany({ where: { variantId: { in: variantIds } } });
      }
      await tx.variant.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
    });

    res.status(204).send();
  } catch (e) {
    if (e instanceof Error && e.message === "PRODUCT_NOT_FOUND") {
      return res.status(404).json({ error: "Товар не найден" });
    }
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
  });
})();