import { plainBotTokenFromStored } from "./businessBotToken.js";
import { prisma } from "./db.js";
import {
  hasValidPaidOrTrialWindow,
} from "./subscriptionAccess.js";
import { isPlatformAdminTelegramId } from "./platformAdminService.js";
import {
  classifyWebhookOkError,
  fetchTelegramWebhookInfo,
} from "./platformTelegramWebhook.js";

export async function platformCheckWebhookForMerchant(input: {
  telegramId: string;
  businessId: number;
}): Promise<
  | { ok: true; status: "OK" | "ERROR"; lastErrorMessage: string | null }
  | { ok: false; status: number; error: string }
> {
  if (!isPlatformAdminTelegramId(input.telegramId)) {
    return {
      ok: false,
      status: 403,
      error: "Проверку webhook может запускать только оператор платформы",
    };
  }

  const b = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: {
      id: true,
      botToken: true,
      isBlocked: true,
      isActive: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
    },
  });
  if (b == null) {
    return { ok: false, status: 404, error: "Магазин не найден" };
  }

  const info = await fetchTelegramWebhookInfo(
    plainBotTokenFromStored(b.botToken),
  );
  const status = classifyWebhookOkError(info);
  return {
    ok: true,
    status,
    lastErrorMessage: info.lastErrorMessage,
  };
}

export async function platformToggleBotForMerchant(input: {
  telegramId: string;
  businessId: number;
  action: "enable" | "disable";
}): Promise<
  | { ok: true; isActive: boolean }
  | { ok: false; status: number; error: string }
> {
  if (!isPlatformAdminTelegramId(input.telegramId)) {
    return {
      ok: false,
      status: 403,
      error: "Включение и отключение бота доступно только оператору платформы",
    };
  }

  const b = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: {
      id: true,
      isBlocked: true,
      isActive: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
    },
  });
  if (b == null) {
    return { ok: false, status: 404, error: "Магазин не найден" };
  }

  if (input.action === "enable") {
    if (b.isBlocked) {
      return {
        ok: false,
        status: 403,
        error: "⛔ Магазин заблокирован администратором",
      };
    }
    if (!hasValidPaidOrTrialWindow(b)) {
      return {
        ok: false,
        status: 403,
        error: "Подписка не активна",
      };
    }
    await prisma.business.update({
      where: { id: input.businessId },
      data: { isActive: true },
    });
    return { ok: true, isActive: true };
  }

  await prisma.business.update({
    where: { id: input.businessId },
    data: { isActive: false },
  });
  return { ok: true, isActive: false };
}
