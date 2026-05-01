import type { Request, Response } from "express";
import {
  getDynamicOwnerBot,
  hydrateDynamicStoreBotIfMissing,
} from "../bot/dynamicBots.js";
import { prisma } from "./db.js";
import {
  sendSubscriptionExpiredChatMessage,
  syncBusinessSubscriptionActivationState,
} from "./saasBillingService.js";

/** При неактивной подписке допускаем /start, /pay и отправку фото (чек). */
export function telegramWebhookAllowsBypassWhenMerchantInactive(
  body: unknown,
): boolean {
  const u = body as Record<string, unknown>;
  const msg = u.message as Record<string, unknown> | undefined;
  if (!msg || typeof msg !== "object") return false;

  const text = typeof msg.text === "string" ? msg.text.trim() : "";

  if (/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) return true;
  if (/^\/pay(?:@\w+)?(?:\s|$)/i.test(text)) return true;

  const photo = msg.photo;
  if (Array.isArray(photo) && photo.length > 0) return true;

  return false;
}

export function extractTelegramWebhookChatId(body: unknown): number | null {
  const u = body as {
    message?: { chat?: { id?: unknown } };
    edited_message?: { chat?: { id?: unknown } };
    channel_post?: { chat?: { id?: unknown } };
    callback_query?: { message?: { chat?: { id?: unknown } } };
  };

  const fromMsg =
    u.message ??
    u.edited_message ??
    u.channel_post ??
    undefined;

  if (fromMsg?.chat?.id !== undefined && fromMsg.chat.id !== null) {
    const n = Number(fromMsg.chat.id);
    if (Number.isFinite(n)) return n;
  }

  const cq = u.callback_query?.message?.chat?.id;
  if (cq !== undefined && cq !== null) {
    const n = Number(cq);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export async function relayDynamicStoreWebhook(
  req: Request,
  res: Response,
  businessId: number,
): Promise<void> {
  if (!Number.isInteger(businessId) || businessId <= 0) {
    res.sendStatus(400);
    return;
  }

  const first = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      isBlocked: true,
      botToken: true,
    },
  });

  if (first == null) {
    res.sendStatus(404);
    return;
  }

  if (first.isBlocked) {
    res.sendStatus(200);
    return;
  }

  await syncBusinessSubscriptionActivationState(businessId);

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      isActive: true,
      isBlocked: true,
      botToken: true,
    },
  });

  if (business == null) {
    res.sendStatus(404);
    return;
  }

  const tok = String(business.botToken ?? "").trim();
  if (tok === "") {
    res.sendStatus(503);
    return;
  }

  if (!business.isActive) {
    const bypass = telegramWebhookAllowsBypassWhenMerchantInactive(req.body);
    if (!bypass) {
      const chatId = extractTelegramWebhookChatId(req.body);
      if (chatId != null) {
        await sendSubscriptionExpiredChatMessage({
          botToken: tok,
          chatId,
        });
      }
      res.sendStatus(200);
      return;
    }
  }

  let tBot = getDynamicOwnerBot(businessId);
  if (!tBot) {
    await hydrateDynamicStoreBotIfMissing(businessId);
    tBot = getDynamicOwnerBot(businessId);
  }

  if (!tBot) {
    res.sendStatus(404);
    return;
  }

  try {
    await tBot.handleUpdate(req.body);
    res.sendStatus(200);
  } catch (e) {
    console.error("webhook (dynamic store):", businessId, e);
    res.sendStatus(500);
  }
}
