import type { Request, Response } from "express";
import {
  getDynamicOwnerBot,
  hydrateDynamicStoreBotIfMissing,
} from "../bot/dynamicBots.js";
import { plainBotTokenFromStored } from "./businessBotToken.js";
import { prisma } from "./db.js";
import { syncBusinessSubscriptionActivationState } from "./saasBillingService.js";
import { isSubscriptionActive } from "./subscriptionAccess.js";

/**
 * При истёкшей подписке всё равно пропускаем сырой /start и /cancel в чат,
 * иначе клиенты не получают ответ бота вообще (вебхук отвечал 200 без handleUpdate).
 */
function webhookUpdateIsStartOrCancelCommandOnly(body: unknown): boolean {
  const u = body as Record<string, unknown>;
  const msg = u.message as Record<string, unknown> | undefined;
  if (!msg || typeof msg !== "object") return false;
  const text = typeof msg.text === "string" ? msg.text.trim() : "";
  if (/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) return true;
  if (/^\/cancel(?:@\w+)?(?:\s|$)/i.test(text)) return true;
  return false;
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
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
    },
  });

  if (business == null) {
    res.sendStatus(404);
    return;
  }

  const tok = plainBotTokenFromStored(business.botToken);
  if (tok === "") {
    res.sendStatus(503);
    return;
  }

  const subscriptionDead = !isSubscriptionActive(business);
  if (
    subscriptionDead &&
    !webhookUpdateIsStartOrCancelCommandOnly(req.body)
  ) {
    res.sendStatus(200);
    return;
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
    console.error(
      "webhook (dynamic store) handler error:",
      businessId,
      e instanceof Error ? e.message : String(e),
    );
    res.sendStatus(500);
  }
}
