import { prisma } from "./db.js";
import { merchantStoreEntitled } from "./subscriptionAccess.js";
import { isValidFinikApiKey } from "../bot/saasRegistrationValidation.js";
import { validateMerchantConfig } from "./templateValidation.js";
import { platformMerchantOwnsBusiness } from "./platformMerchantAccess.js";
import { templateForBusinessType } from "../templates/index.js";
import {
  createMerchantBotTokenChangeRequest,
  MERCHANT_CHANGE_STATUS_PENDING,
  MERCHANT_CHANGE_TYPE_BOT_TOKEN,
} from "./platformMerchantChangeService.js";
import { PLATFORM_STORE_NAME_MAX, PLATFORM_STORE_NAME_MIN } from "./platformRegisterRequest.js";
import { cleanInput } from "./orderInputSanitize.js";

export type PlatformStoreSettingsDTO = {
  businessId: number;
  name: string;
  finikConfigured: boolean;
  pendingBotTokenChange: boolean;
  businessType: string;
  merchantConfig: Record<string, unknown>;
  merchantSettingsSchema: Record<string, unknown>;
};

export async function getPlatformStoreSettingsForMerchant(input: {
  telegramId: string;
  businessId: number;
}): Promise<
  | { ok: true; settings: PlatformStoreSettingsDTO }
  | { ok: false; statusCode: number; error: string }
> {
  const allowed = await platformMerchantOwnsBusiness(
    input.telegramId,
    input.businessId,
  );
  if (!allowed) {
    return { ok: false, statusCode: 403, error: "Нет доступа к этому магазину" };
  }

  const b = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: {
      id: true,
      name: true,
      finikApiKey: true,
      businessType: true,
      merchantConfig: true,
    },
  });
  if (b == null) {
    return { ok: false, statusCode: 404, error: "Магазин не найден" };
  }

  const pending = await prisma.merchantChangeRequest.findFirst({
    where: {
      businessId: input.businessId,
      type: MERCHANT_CHANGE_TYPE_BOT_TOKEN,
      status: MERCHANT_CHANGE_STATUS_PENDING,
    },
    select: { id: true },
  });

  const finikConfigured =
    typeof b.finikApiKey === "string" && b.finikApiKey.trim().length > 0;

  return {
    ok: true,
    settings: {
      businessId: b.id,
      name: b.name,
      finikConfigured,
      pendingBotTokenChange: pending != null,
      businessType: String((b as any).businessType ?? ""),
      merchantConfig:
        (b as any).merchantConfig != null &&
        typeof (b as any).merchantConfig === "object" &&
        !Array.isArray((b as any).merchantConfig)
          ? ((b as any).merchantConfig as Record<string, unknown>)
          : {},
      merchantSettingsSchema: (() => {
        const bt = String((b as any).businessType ?? "");
        if (bt !== "") {
          try {
            return (templateForBusinessType(bt as any).merchantSettingsSchema ??
              {}) as Record<string, unknown>;
          } catch {
            return {};
          }
        }
        return {};
      })(),
    },
  };
}

export type PlatformStoreSettingsUpdateBody = {
  storeName?: unknown;
  finikApiKey?: unknown;
  newBotToken?: unknown;
  merchantConfig?: unknown;
};

export async function updatePlatformStoreSettingsForMerchant(input: {
  telegramId: string;
  businessId: number;
  body: PlatformStoreSettingsUpdateBody;
}): Promise<
  | {
      ok: true;
      name: string;
      finikConfigured: boolean;
      pendingBotTokenChange: boolean;
      botTokenChangeRequestId?: number;
    }
  | { ok: false; statusCode: number; error: string }
> {
  const allowed = await platformMerchantOwnsBusiness(
    input.telegramId,
    input.businessId,
  );
  if (!allowed) {
    return { ok: false, statusCode: 403, error: "Нет доступа к этому магазину" };
  }

  const entitledRow = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: {
      isBlocked: true,
      isActive: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
    },
  });
  if (!entitledRow || !merchantStoreEntitled(entitledRow)) {
    return { ok: false, statusCode: 403, error: "Подписка не активна" };
  }

  const rawName = input.body.storeName;
  const rawFinik = input.body.finikApiKey;
  const rawTok = input.body.newBotToken;
  const rawMerchantConfig = input.body.merchantConfig;

  const hasName =
    rawName !== undefined &&
    !(typeof rawName === "string" && rawName.trim() === "");
  const hasFinik = rawFinik !== undefined;
  const hasTok =
    rawTok !== undefined &&
    !(typeof rawTok === "string" && rawTok.replace(/\s/g, "").trim() === "");
  const hasMerchantConfig = rawMerchantConfig !== undefined;

  if (!hasName && !hasFinik && !hasTok && !hasMerchantConfig) {
    return {
      ok: false,
      statusCode: 400,
      error: "Укажите storeName, finikApiKey, newBotToken и/или merchantConfig",
    };
  }

  if (hasName) {
    const storeRaw =
      typeof rawName === "string" ? cleanInput(rawName) : "";
    if (
      storeRaw.length < PLATFORM_STORE_NAME_MIN ||
      storeRaw.length > PLATFORM_STORE_NAME_MAX
    ) {
      return {
        ok: false,
        statusCode: 400,
        error: `Название: от ${PLATFORM_STORE_NAME_MIN} до ${PLATFORM_STORE_NAME_MAX} символов`,
      };
    }
    await prisma.business.update({
      where: { id: input.businessId },
      data: { name: storeRaw },
    });
  }

  if (hasFinik) {
    const finikRaw = typeof rawFinik === "string" ? rawFinik : "";
    if (finikRaw.trim() === "") {
      await prisma.business.update({
        where: { id: input.businessId },
        data: { finikApiKey: null },
      });
      await prisma.settings.updateMany({
        where: { businessId: input.businessId },
        data: { paymentProvider: null },
      });
    } else {
      if (!isValidFinikApiKey(finikRaw)) {
        return {
          ok: false,
          statusCode: 400,
          error: "Некорректный API-ключ Finik",
        };
      }
      const trimmed = finikRaw.trim();
      await prisma.business.update({
        where: { id: input.businessId },
        data: { finikApiKey: trimmed },
      });
      await prisma.settings.upsert({
        where: { businessId: input.businessId },
        create: {
          businessId: input.businessId,
          paymentProvider: "finik",
        },
        update: { paymentProvider: "finik" },
      });
    }
  }

  if (hasMerchantConfig) {
    const b = await prisma.business.findUnique({
      where: { id: input.businessId },
      select: { id: true, businessType: true },
    });
    const bt = (b as any)?.businessType;
    if (typeof bt !== "string" || bt.trim() === "") {
      return { ok: false, statusCode: 400, error: "Магазин без businessType" };
    }
    const v = validateMerchantConfig(bt as any, rawMerchantConfig);
    if (!v.ok) {
      return { ok: false, statusCode: 400, error: v.error };
    }
    await prisma.business.update({
      where: { id: input.businessId },
      data: { merchantConfig: v.value } as any,
    });
  }

  let botTokenChangeRequestId: number | undefined;
  if (hasTok) {
    const tok =
      typeof rawTok === "string" ? rawTok.replace(/\s/g, "").trim() : "";
    const cr = await createMerchantBotTokenChangeRequest({
      businessId: input.businessId,
      requesterTelegramId: input.telegramId,
      newBotToken: tok,
    });
    if (!cr.ok) {
      return { ok: false, statusCode: cr.statusCode, error: cr.error };
    }
    botTokenChangeRequestId = cr.id;
  }

  const snap = await getPlatformStoreSettingsForMerchant({
    telegramId: input.telegramId,
    businessId: input.businessId,
  });
  if (!snap.ok) {
    return { ok: false, statusCode: snap.statusCode, error: snap.error };
  }

  return {
    ok: true,
    name: snap.settings.name,
    finikConfigured: snap.settings.finikConfigured,
    pendingBotTokenChange: snap.settings.pendingBotTokenChange,
    ...(botTokenChangeRequestId != null ? { botTokenChangeRequestId } : {}),
  };
}

/** Сохранение ключа Finik отдельно от остальных настроек (ключ не отдаём клиенту). */
export async function updatePlatformFinikForMerchant(input: {
  telegramId: string;
  businessId: number;
  finikApiKey: unknown;
}): Promise<
  | { ok: true; finikConfigured: boolean }
  | { ok: false; statusCode: number; error: string }
> {
  const allowed = await platformMerchantOwnsBusiness(
    input.telegramId,
    input.businessId,
  );
  if (!allowed) {
    return { ok: false, statusCode: 403, error: "Нет доступа к этому магазину" };
  }

  const entitledRow = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: {
      isBlocked: true,
      isActive: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
    },
  });
  if (!entitledRow || !merchantStoreEntitled(entitledRow)) {
    return { ok: false, statusCode: 403, error: "Подписка не активна" };
  }

  const raw = input.finikApiKey;
  const finikRaw = typeof raw === "string" ? raw : "";

  if (finikRaw.trim() === "") {
    await prisma.business.update({
      where: { id: input.businessId },
      data: { finikApiKey: null },
    });
    await prisma.settings.updateMany({
      where: { businessId: input.businessId },
      data: { paymentProvider: null },
    });
  } else {
    if (!isValidFinikApiKey(finikRaw)) {
      return {
        ok: false,
        statusCode: 400,
        error: "Некорректный API-ключ Finik",
      };
    }
    const trimmed = finikRaw.trim();
    await prisma.business.update({
      where: { id: input.businessId },
      data: { finikApiKey: trimmed },
    });
    await prisma.settings.upsert({
      where: { businessId: input.businessId },
      create: {
        businessId: input.businessId,
        paymentProvider: "finik",
      },
      update: { paymentProvider: "finik" },
    });
  }

  const snap = await getPlatformStoreSettingsForMerchant({
    telegramId: input.telegramId,
    businessId: input.businessId,
  });
  if (!snap.ok) {
    return { ok: false, statusCode: snap.statusCode, error: snap.error };
  }
  return { ok: true, finikConfigured: snap.settings.finikConfigured };
}
