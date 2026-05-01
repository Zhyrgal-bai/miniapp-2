import type { Express, Request, Response } from "express";
import { MembershipRole } from "@prisma/client";
import { prisma } from "./db.js";
import { adminUserIdFromRequest } from "./adminAuth.js";
import { notifyAfterOrderStatusChangeFromApi } from "./orderTelegramNotify.js";

/** Base URL для REST Finik (укажите реальный домен вашего аккаунта разработчика). */
function finikApiBase(): string {
  return (process.env.FINIK_API_BASE_URL || "https://api.finik.kg").trim().replace(
    /\/$/,
    ""
  );
}

/** Путь создания платежа относительно base (можно переопределить через env). */
function finikCreatePaymentsPath(): string {
  const p = (
    process.env.FINIK_API_CREATE_PAYMENT_PATH || "/payments"
  ).trim();
  return p.startsWith("/") ? p : `/${p}`;
}

/** Публичный URL API без хвоста slash — для webhook. */
export function publicApiOrigin(): string {
  const manual = (process.env.API_URL ?? "").trim();
  if (manual) return manual.replace(/\/$/, "");
  /** Render.com задаёт автоматически, если не задан API_URL. */
  const render = (process.env.RENDER_EXTERNAL_URL ?? "").trim();
  return render ? render.replace(/\/$/, "") : "";
}

/**
 * Создание платежа через Finik аккаунт клиента:
 * ключи только из строки Business, не платформы.
 *
 * Если `FINIK_USE_MOCK=true` или у бизнеса нет ключей — возвращает мок (только dev).
 */
export async function createFinikMerchantSession(
  business: {
    id: number;
    finikApiKey: string | null;
    finikSecret: string | null;
  },
  input: { orderId: number; amount: number; currency?: string }
): Promise<
  | { ok: true; paymentId: string; paymentUrl: string }
  | { ok: false; error: string }
> {
  const useMock =
    process.env.FINIK_USE_MOCK === "1" ||
    process.env.FINIK_USE_MOCK === "true" ||
    !business.finikApiKey?.trim() ||
    !business.finikSecret?.trim();

  if (useMock) {
    const paymentId = `finik_${Date.now()}_${input.orderId}`;
    const paymentUrl = `https://pay.finik.kg/?amount=${input.amount}&orderId=${encodeURIComponent(paymentId)}`;
    return { ok: true, paymentId, paymentUrl };
  }

  const origin = publicApiOrigin();
  if (!origin) {
    return {
      ok: false,
      error: "Сервер: задайте API_URL (публичный URL) для callback Finik",
    };
  }

  const callbackUrl = `${origin}/finik/webhook/${business.id}`;

  const url = `${finikApiBase()}${finikCreatePaymentsPath()}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${business.finikApiKey!.trim()}`,
        "X-Api-Secret": business.finikSecret!.trim(),
      },
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency ?? "KGS",
        order_id: String(input.orderId),
        external_id: `${business.id}:${input.orderId}`,
        callback_url: callbackUrl,
        return_url: callbackUrl,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      console.error("Finik create payment HTTP", res.status, json);
      return {
        ok: false,
        error: "Finik API отклонил запрос (проверьте ключи и URL API)",
      };
    }

    const paymentId =
      (typeof json.payment_id === "string" && json.payment_id) ||
      (typeof json.id === "string" && json.id) ||
      (typeof json.paymentId === "string" && json.paymentId) ||
      "";
    const paymentUrl =
      (typeof json.payment_url === "string" && json.payment_url) ||
      (typeof json.url === "string" && json.url) ||
      (typeof json.checkout_url === "string" && json.checkout_url) ||
      "";

    if (!paymentId || !paymentUrl) {
      console.error("Finik create payment: unexpected body", json);
      return {
        ok: false,
        error: "Finik: неверный ответ API (ожидаются payment id и url)",
      };
    }

    return { ok: true, paymentId, paymentUrl };
  } catch (e) {
    console.error("Finik create payment fetch:", e);
    return { ok: false, error: "Ошибка сети при обращении к Finik" };
  }
}

/**
 * Проверка подписи вебхука (если Finik шлёт HMAC в заголовке).
 * Настройте имя заголовка через FINIK_WEBHOOK_SIGNATURE_HEADER.
 */
function verifyFinikWebhookSignature(
  businessSecret: string | null,
  req: Request,
  rawBody: string
): boolean {
  const headerName = (
    process.env.FINIK_WEBHOOK_SIGNATURE_HEADER || ""
  ).trim().toLowerCase();
  if (!headerName || !businessSecret?.trim()) return true;

  const sig = req.headers[headerName];
  const got = Array.isArray(sig) ? sig[0] : sig;
  if (typeof got !== "string" || !got) return false;

  return got === businessSecret.trim() || got === `sha256=${businessSecret.trim()}`;
}

async function handleFinikWebhookForBusiness(
  businessId: number,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business) {
      res.status(404).json({ error: "Business not found" });
      return;
    }

    const rawBody =
      typeof req.body === "object" && req.body !== null
        ? JSON.stringify(req.body)
        : String(req.body ?? "");

    if (!verifyFinikWebhookSignature(business.finikSecret, req, rawBody)) {
      res.status(403).json({ error: "Invalid signature" });
      return;
    }

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
      res.status(400).json({ error: "paymentId required" });
      return;
    }

    const successStatuses = new Set([
      "success",
      "paid",
      "completed",
      "succeeded",
    ]);
    if (!successStatuses.has(status)) {
      res.json({ ok: true, ignored: true });
      return;
    }

    const order = await prisma.order.findFirst({
      where: { paymentId, businessId },
      include: { buyerUser: true },
    });

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (String(order.paymentMethod ?? "").toLowerCase() !== "finik") {
      res.status(400).json({ error: "Not a Finik order" });
      return;
    }

    const cur = String(order.status ?? "").toUpperCase();
    if (cur === "CONFIRMED" || cur === "SHIPPED") {
      res.json({ ok: true, duplicate: true });
      return;
    }
    if (cur === "CANCELLED") {
      res.status(400).json({ error: "Order cancelled" });
      return;
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: "CONFIRMED" },
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

    res.json({ ok: true });
  } catch (e) {
    console.error("FINIK WEBHOOK:", businessId, e);
    res.status(500).json({ error: "Webhook error" });
  }
}

/**
 * Регистрирует:
 * - `POST /finik/webhook/:businessId` — основной вебхук с идентификатором тенанта;
 * - `POST /finik/webhook` — legacy: по заказу по `paymentId` вызывает обработчик с верным businessId.
 */
export function mountFinikWebhookRoutes(app: Express): void {
  app.post(
    "/finik/webhook/:businessId",
    async (req: Request, res: Response) => {
      const businessId = Number(req.params.businessId);
      if (!Number.isInteger(businessId) || businessId <= 0) {
        res.status(400).json({ error: "Invalid businessId" });
        return;
      }
      await handleFinikWebhookForBusiness(businessId, req, res);
    }
  );

  app.post("/finik/webhook", async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const paymentIdRaw =
        body.paymentId ?? body.payment_id ?? body.orderId ?? body.order_id;
      const paymentId =
        paymentIdRaw != null && String(paymentIdRaw).trim() !== ""
          ? String(paymentIdRaw).trim()
          : "";
      if (!paymentId) {
        res.status(400).json({ error: "paymentId required" });
        return;
      }
      const order = await prisma.order.findFirst({
        where: { paymentId },
        select: { businessId: true },
      });
      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }
      await handleFinikWebhookForBusiness(order.businessId, req, res);
    } catch (e) {
      console.error("FINIK WEBHOOK LEGACY:", e);
      res.status(500).json({ error: "Webhook error" });
    }
  });
}

/**
 * Настройка Finik для магазина (только админ магазина). Ключи не возвращаются в ответе.
 */
export function mountFinikSettingsRoutes(app: Express): void {
  app.get("/integrations/finik", async (req: Request, res: Response) => {
    try {
      const businessId = Number(
        (req.query as { businessId?: string }).businessId
      );
      if (!Number.isInteger(businessId) || businessId <= 0) {
        res.status(400).json({ error: "Нужен query businessId" });
        return;
      }

      const b = await prisma.business.findUnique({
        where: { id: businessId },
        select: {
          id: true,
          finikApiKey: true,
          finikSecret: true,
        },
      });
      if (!b) {
        res.status(404).json({ error: "Магазин не найден" });
        return;
      }

      const telegramId = adminUserIdFromRequest(req);
      const telegramStr =
        telegramId !== undefined &&
        telegramId !== null &&
        String(telegramId).trim() !== ""
          ? String(telegramId).trim()
          : "";
      if (!telegramStr) {
        res.status(400).json({ error: "Нужен userId (Telegram) в теле или query" });
        return;
      }

      const allowed = await prisma.membership.findFirst({
        where: {
          businessId,
          role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN] },
          user: { telegramId: telegramStr },
        },
      });
      if (!allowed) {
        res.status(403).json({ error: "Нет доступа к этому магазину" });
        return;
      }

      res.json({
        businessId: b.id,
        finikConfigured: !!(b.finikApiKey?.trim() && b.finikSecret?.trim()),
        webhookUrl: publicApiOrigin()
          ? `${publicApiOrigin()}/finik/webhook/${b.id}`
          : null,
      });
    } catch (e) {
      console.error("GET /integrations/finik:", e);
      res.status(500).json({ error: "failed" });
    }
  });

  app.post("/integrations/finik", async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const businessId = Number(body.businessId);
      if (!Number.isInteger(businessId) || businessId <= 0) {
        res.status(400).json({ error: "Нужен body.businessId" });
        return;
      }

      const telegramId = adminUserIdFromRequest(req);
      const telegramStr =
        telegramId !== undefined &&
        telegramId !== null &&
        String(telegramId).trim() !== ""
          ? String(telegramId).trim()
          : "";
      if (!telegramStr) {
        res.status(400).json({ error: "Нужен userId (Telegram) в теле или query" });
        return;
      }

      const allowed = await prisma.membership.findFirst({
        where: {
          businessId,
          role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN] },
          user: { telegramId: telegramStr },
        },
      });
      if (!allowed) {
        res.status(403).json({ error: "Нет доступа к этому магазину" });
        return;
      }

      const finikApiKey =
        typeof body.finikApiKey === "string" ? body.finikApiKey.trim() : "";
      const finikSecret =
        typeof body.finikSecret === "string" ? body.finikSecret.trim() : "";

      await prisma.business.update({
        where: { id: businessId },
        data: {
          finikApiKey: finikApiKey === "" ? null : finikApiKey,
          finikSecret: finikSecret === "" ? null : finikSecret,
        },
      });

      res.json({
        ok: true,
        businessId,
        finikConfigured: !!(finikApiKey && finikSecret),
        webhookUrl: publicApiOrigin()
          ? `${publicApiOrigin()}/finik/webhook/${businessId}`
          : null,
      });
    } catch (e) {
      console.error("POST /integrations/finik:", e);
      res.status(500).json({ error: "failed" });
    }
  });
}
