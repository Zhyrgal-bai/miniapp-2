import type { Express, Request, Response } from "express";
import { prisma } from "./db.js";
import {
  createFinikSaasSubscriptionSession,
  verifyFinikWebhookSignature,
} from "./finikMerchant.js";
import {
  extendBusinessSubscriptionAfterFinikPayment,
  saasFinikSubscriptionPlanSpec,
} from "./saasBillingService.js";
import { platformMerchantOwnsBusiness } from "./platformMerchantAccess.js";

function telegramIdFromTrustedHeader(req: Request): string | null {
  const rawXi = req.headers["x-telegram-id"];
  const xi =
    typeof rawXi === "string"
      ? rawXi.trim()
      : Array.isArray(rawXi) && typeof rawXi[0] === "string"
        ? rawXi[0].trim()
        : "";
  return /^\d+$/.test(xi) ? xi : null;
}

function parsePlanDays(raw: unknown): 30 | 90 | null {
  const n =
    typeof raw === "number" && Number.isFinite(raw)
      ? Math.trunc(raw)
      : typeof raw === "string"
        ? Number(raw.trim())
        : NaN;
  if (n === 30 || n === 90) return n;
  return null;
}

function extractPaymentId(body: Record<string, unknown>): string {
  const paymentIdRaw =
    body.paymentId ??
    body.payment_id ??
    body.id ??
    body.orderId ??
    body.order_id;
  return paymentIdRaw != null && String(paymentIdRaw).trim() !== ""
    ? String(paymentIdRaw).trim()
    : "";
}

function parseSaasSubRowId(body: Record<string, unknown>): number | null {
  const candidates: unknown[] = [
    body.external_id,
    body.externalId,
    body.order_id,
    body.orderId,
  ];
  const meta =
    typeof body.metadata === "object" && body.metadata !== null
      ? (body.metadata as Record<string, unknown>)
      : null;
  if (meta != null) {
    candidates.push(meta.external_id, meta.externalId);
  }
  const prefix = "saas_sub:";
  for (const c of candidates) {
    if (typeof c !== "string") continue;
    const s = c.trim();
    if (s.startsWith(prefix)) {
      const n = Number(s.slice(prefix.length));
      if (Number.isInteger(n) && n > 0) return n;
    }
  }
  return null;
}

async function sendOwnerPaymentSuccessNotice(
  botToken: string,
  telegramUserId: string,
): Promise<void> {
  const chatId = Number(telegramUserId);
  if (!Number.isFinite(chatId) || chatId <= 0) return;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "✅ Оплата прошла успешно. Подписка активирована",
        }),
      },
    );
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
    if (!res.ok || json.ok === false) {
      console.error(
        "subscriptionFinik sendMessage failed",
        chatId,
        res.status,
        json,
      );
    }
  } catch (e) {
    console.error("subscriptionFinik sendMessage", e);
  }
}

/** Finik ключи есть на Business; секрет нужен для вебхука и создания платежа (как у заказов). */
function businessFinikReady(finikApiKey: string | null, finikSecret: string | null): boolean {
  const k = typeof finikApiKey === "string" ? finikApiKey.trim() : "";
  const s = typeof finikSecret === "string" ? finikSecret.trim() : "";
  if (process.env.FINIK_USE_MOCK === "1" || process.env.FINIK_USE_MOCK === "true") {
    return true;
  }
  return k.length > 0 && s.length > 0;
}

export function mountSubscriptionFinikPaymentRoutes(app: Express): void {
  app.post("/api/payments/create", async (req: Request, res: Response) => {
    try {
      const telegramId = telegramIdFromTrustedHeader(req);
      if (!telegramId) {
        res.status(400).json({
          error:
            "Нужен заголовок x-telegram-id с числовым Telegram user id",
        });
        return;
      }

      const body = req.body as { businessId?: unknown; plan?: unknown };
      const rawBid = body.businessId;
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

      const plan = parsePlanDays(body.plan);
      if (plan == null) {
        res.status(400).json({ error: "Параметр plan: 30 или 90 (дней)" });
        return;
      }

      const allowed = await platformMerchantOwnsBusiness(
        telegramId,
        businessId,
      );
      if (!allowed) {
        res.status(403).json({ error: "Нет доступа к этому магазину" });
        return;
      }

      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { id: true, finikApiKey: true, finikSecret: true, botToken: true },
      });
      if (business == null) {
        res.status(404).json({ error: "Магазин не найден" });
        return;
      }

      if (!businessFinikReady(business.finikApiKey, business.finikSecret)) {
        res.status(200).json({
          finikConfigured: false,
          useManualPaymentRequest: true,
          message:
            "Онлайн-оплата Finik не настроена для магазина. Отправьте чек на проверку через бота (ручная заявка PaymentRequest).",
        });
        return;
      }

      const spec = saasFinikSubscriptionPlanSpec(plan);

      const row = await prisma.subscriptionFinikPayment.create({
        data: {
          businessId,
          planDays: spec.days,
          amountSom: spec.amountSom,
          payerTelegramId: telegramId,
          status: "pending",
        },
      });

      const finik = await createFinikSaasSubscriptionSession(
        {
          id: business.id,
          finikApiKey: business.finikApiKey,
          finikSecret: business.finikSecret,
        },
        {
          subscriptionPaymentRowId: row.id,
          amountSom: spec.amountSom,
        },
      );

      if (!finik.ok) {
        await prisma.subscriptionFinikPayment.update({
          where: { id: row.id },
          data: { status: "failed" },
        });
        res.status(502).json({ error: finik.error });
        return;
      }

      await prisma.subscriptionFinikPayment.update({
        where: { id: row.id },
        data: { finikPaymentId: finik.paymentId },
      });

      res.json({
        paymentUrl: finik.paymentUrl,
        subscriptionPaymentId: row.id,
        planDays: spec.days,
        amountSom: spec.amountSom,
      });
    } catch (e) {
      console.error("POST /api/payments/create:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.post(
    "/api/payments/finik-webhook",
    async (req: Request, res: Response) => {
      try {
        const rawBody =
          typeof req.body === "object" && req.body !== null
            ? JSON.stringify(req.body)
            : String(req.body ?? "");

        const body = req.body as Record<string, unknown>;
        const paymentId = extractPaymentId(body);

        let subRow =
          paymentId !== ""
            ? await prisma.subscriptionFinikPayment.findFirst({
                where: { finikPaymentId: paymentId },
              })
            : null;

        if (subRow == null) {
          const sid = parseSaasSubRowId(body);
          if (sid != null) {
            subRow = await prisma.subscriptionFinikPayment.findUnique({
              where: { id: sid },
            });
          }
        }

        if (subRow == null) {
          res.status(404).json({ error: "Subscription payment not found" });
          return;
        }

        const business = await prisma.business.findUnique({
          where: { id: subRow.businessId },
        });
        if (business == null) {
          res.status(404).json({ error: "Business not found" });
          return;
        }

        if (
          !verifyFinikWebhookSignature(business.finikSecret, req, rawBody)
        ) {
          res.status(403).json({ error: "Invalid signature" });
          return;
        }

        if (paymentId !== "" && subRow.finikPaymentId == null) {
          await prisma.subscriptionFinikPayment.update({
            where: { id: subRow.id },
            data: { finikPaymentId: paymentId },
          });
        }

        const statusRaw = body.status ?? body.payment_status ?? body.state;
        const status = String(statusRaw ?? "").toLowerCase();
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

        if (subRow.status === "completed") {
          res.json({ ok: true, duplicate: true });
          return;
        }

        const outcome = await prisma.$transaction(async (tx) => {
          const claimed = await tx.subscriptionFinikPayment.updateMany({
            where: { id: subRow.id, status: "pending" },
            data: { status: "completed" },
          });
          if (claimed.count !== 1) {
            return { kind: "duplicate" as const };
          }

          const ext = await extendBusinessSubscriptionAfterFinikPayment(
            subRow.businessId,
            subRow.planDays,
            new Date(),
            tx,
          );
          return { kind: "applied" as const, ext };
        });

        if (outcome.kind === "duplicate") {
          res.json({ ok: true, duplicate: true });
          return;
        }

        const ext = outcome.ext;
        if (
          ext?.shouldHydrateBot &&
          ext.botToken != null &&
          String(ext.botToken).trim() !== ""
        ) {
          const { initDynamicStoreBot } = await import(
            "../bot/dynamicBots.js"
          );
          try {
            await initDynamicStoreBot({
              businessId: subRow.businessId,
              botToken: String(ext.botToken).trim(),
            });
          } catch (e) {
            console.error(
              "subscriptionFinik webhook: hydrate bot failed",
              subRow.businessId,
              e,
            );
          }
        }

        const tok = String(business.botToken ?? "").trim();
        if (tok) {
          void sendOwnerPaymentSuccessNotice(tok, subRow.payerTelegramId);
        }

        res.json({ ok: true });
      } catch (e) {
        console.error("POST /api/payments/finik-webhook:", e);
        res.status(500).json({ error: "Webhook error" });
      }
    },
  );
}
