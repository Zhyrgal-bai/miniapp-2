import { prisma } from "./db.js";
import { platformMerchantOwnsBusiness } from "./platformMerchantAccess.js";
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
  const allowed = await platformMerchantOwnsBusiness(
    input.telegramId,
    input.businessId,
  );
  if (!allowed) {
    return { ok: false, status: 403, error: "Нет доступа к этому магазину" };
  }

  const b = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: { id: true, botToken: true },
  });
  if (b == null) {
    return { ok: false, status: 404, error: "Магазин не найден" };
  }

  const info = await fetchTelegramWebhookInfo(String(b.botToken ?? ""));
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
  const allowed = await platformMerchantOwnsBusiness(
    input.telegramId,
    input.businessId,
  );
  if (!allowed) {
    return { ok: false, status: 403, error: "Нет доступа к этому магазину" };
  }

  const b = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: { id: true, isBlocked: true, isActive: true },
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
