import { prisma } from "./db.js";
import { merchantStoreEntitled } from "./subscriptionAccess.js";
import {
  isValidFinikApiKey,
  isValidFinikSecret,
} from "../bot/saasRegistrationValidation.js";
import {
  buildFinikWebhookUrl,
  finikHasApiKey,
  finikHasSecret,
  isFinikCredentialsReady,
} from "../shared/finikReady.js";
import { publicApiOrigin } from "./finikMerchant.js";
import { validateMerchantConfig } from "./templateValidation.js";
import { platformMerchantCanAccessStoreSettings } from "./platformMerchantAccess.js";
import { isPlatformAdminTelegramId } from "./platformAdminService.js";
import { templateForBusinessType } from "../templates/index.js";
import {
  applyOwnerBotTokenSelfService,
  createMerchantBotTokenChangeRequest,
  MERCHANT_CHANGE_STATUS_PENDING,
  MERCHANT_CHANGE_TYPE_BOT_TOKEN,
} from "./platformMerchantChangeService.js";
import { platformMerchantIsStoreOwner } from "./platformMerchantAccess.js";
import { PLATFORM_STORE_NAME_MAX, PLATFORM_STORE_NAME_MIN } from "./platformRegisterRequest.js";
import { cleanInput } from "./orderInputSanitize.js";

export type PlatformStoreSettingsDTO = {
  businessId: number;
  name: string;
  /** @deprecated Используйте finikReady — оставлено для совместимости. */
  finikConfigured: boolean;
  finikReady: boolean;
  finikHasApiKey: boolean;
  finikHasSecret: boolean;
  finikWebhookUrl: string | null;
  pendingBotTokenChange: boolean;
  businessType: string;
  merchantConfig: Record<string, unknown>;
  merchantSettingsSchema: Record<string, unknown>;
  subscriptionStatus: string;
  subscriptionEndsAt: string | null;
  trialEndsAt: string | null;
};

export async function getPlatformStoreSettingsForMerchant(input: {
  telegramId: string;
  businessId: number;
}): Promise<
  | { ok: true; settings: PlatformStoreSettingsDTO }
  | { ok: false; statusCode: number; error: string }
> {
  const allowed = await platformMerchantCanAccessStoreSettings(
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
      finikSecret: true,
      businessType: true,
      merchantConfig: true,
      subscriptionStatus: true,
      subscriptionEndsAt: true,
      trialEndsAt: true,
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

  const ready = isFinikCredentialsReady(b.finikApiKey, b.finikSecret);
  const origin = publicApiOrigin();

  return {
    ok: true,
    settings: {
      businessId: b.id,
      name: b.name,
      finikConfigured: ready,
      finikReady: ready,
      finikHasApiKey: finikHasApiKey(b.finikApiKey),
      finikHasSecret: finikHasSecret(b.finikSecret),
      finikWebhookUrl: buildFinikWebhookUrl(origin, b.id),
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
      subscriptionStatus: String(b.subscriptionStatus ?? ""),
      subscriptionEndsAt: b.subscriptionEndsAt?.toISOString() ?? null,
      trialEndsAt: b.trialEndsAt?.toISOString() ?? null,
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
      botTokenApplied?: boolean;
      botUsername?: string | null;
    }
  | { ok: false; statusCode: number; error: string }
> {
  const allowed = await platformMerchantCanAccessStoreSettings(
    input.telegramId,
    input.businessId,
  );
  if (!allowed) {
    return { ok: false, statusCode: 403, error: "Нет доступа к этому магазину" };
  }

  const isAdmin = isPlatformAdminTelegramId(input.telegramId);
  if (!isAdmin) {
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
        data: { finikApiKey: null, finikSecret: null },
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
      const existing = await prisma.business.findUnique({
        where: { id: input.businessId },
        select: { finikSecret: true },
      });
      if (!finikHasSecret(existing?.finikSecret)) {
        return {
          ok: false,
          statusCode: 400,
          error:
            "Укажите Finik Secret в кабинете (/merchant → Finik). Одного API Key недостаточно.",
        };
      }
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
  let botTokenApplied = false;
  let botUsername: string | null | undefined;
  if (hasTok) {
    const tok =
      typeof rawTok === "string" ? rawTok.replace(/\s/g, "").trim() : "";
    const isOwner = await platformMerchantIsStoreOwner(
      input.telegramId,
      input.businessId,
    );
    if (isOwner && !isAdmin) {
      const applied = await applyOwnerBotTokenSelfService({
        businessId: input.businessId,
        requesterTelegramId: input.telegramId,
        newBotToken: tok,
      });
      if (!applied.ok) {
        return {
          ok: false,
          statusCode: applied.statusCode,
          error: applied.error,
        };
      }
      botTokenApplied = true;
      botUsername = applied.botUsername;
    } else {
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
    ...(botTokenApplied ? { botTokenApplied: true, botUsername: botUsername ?? null } : {}),
  };
}

/** Сохранение Finik API Key + Secret (значения не отдаём клиенту после сохранения). */
export async function savePlatformFinikForMerchant(input: {
  telegramId: string;
  businessId: number;
  finikApiKey?: unknown;
  finikSecret?: unknown;
}): Promise<
  | {
      ok: true;
      finikConfigured: boolean;
      finikReady: boolean;
      finikHasApiKey: boolean;
      finikHasSecret: boolean;
      finikWebhookUrl: string | null;
    }
  | { ok: false; statusCode: number; error: string }
> {
  const allowed = await platformMerchantCanAccessStoreSettings(
    input.telegramId,
    input.businessId,
  );
  if (!allowed) {
    return { ok: false, statusCode: 403, error: "Нет доступа к этому магазину" };
  }

  const isAdmin = isPlatformAdminTelegramId(input.telegramId);
  if (!isAdmin) {
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
  }

  const keyProvided = input.finikApiKey !== undefined;
  const secretProvided = input.finikSecret !== undefined;
  if (!keyProvided && !secretProvided) {
    return {
      ok: false,
      statusCode: 400,
      error: "Укажите finikApiKey и/или finikSecret",
    };
  }

  const existing = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: { finikApiKey: true, finikSecret: true },
  });
  if (existing == null) {
    return { ok: false, statusCode: 404, error: "Магазин не найден" };
  }

  const keyRaw = keyProvided
    ? typeof input.finikApiKey === "string"
      ? input.finikApiKey.trim()
      : ""
    : null;
  const secretRaw = secretProvided
    ? typeof input.finikSecret === "string"
      ? input.finikSecret.trim()
      : ""
    : null;

  const disconnect =
    keyProvided &&
    keyRaw === "" &&
    (!secretProvided || secretRaw === "");

  if (disconnect) {
    await prisma.business.update({
      where: { id: input.businessId },
      data: { finikApiKey: null, finikSecret: null },
    });
    await prisma.settings.updateMany({
      where: { businessId: input.businessId },
      data: { paymentProvider: null },
    });
  } else {
    let nextKey = existing.finikApiKey;
    let nextSecret = existing.finikSecret;

    if (keyProvided && keyRaw != null && keyRaw !== "") {
      if (!isValidFinikApiKey(keyRaw)) {
        return {
          ok: false,
          statusCode: 400,
          error: "Некорректный API-ключ Finik",
        };
      }
      nextKey = keyRaw;
    }

    if (secretProvided && secretRaw != null && secretRaw !== "") {
      if (!isValidFinikSecret(secretRaw)) {
        return {
          ok: false,
          statusCode: 400,
          error: "Некорректный Finik Secret",
        };
      }
      nextSecret = secretRaw;
    }

    if (!finikHasApiKey(nextKey)) {
      return {
        ok: false,
        statusCode: 400,
        error: "Укажите API Key Finik",
      };
    }
    if (!finikHasSecret(nextSecret)) {
      return {
        ok: false,
        statusCode: 400,
        error: "Укажите Secret Finik — без него оплата заказов не работает",
      };
    }

    await prisma.business.update({
      where: { id: input.businessId },
      data: {
        finikApiKey: nextKey,
        finikSecret: nextSecret,
      },
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
  const s = snap.settings;
  return {
    ok: true,
    finikConfigured: s.finikReady,
    finikReady: s.finikReady,
    finikHasApiKey: s.finikHasApiKey,
    finikHasSecret: s.finikHasSecret,
    finikWebhookUrl: s.finikWebhookUrl,
  };
}

/** @deprecated Используйте savePlatformFinikForMerchant */
export async function updatePlatformFinikForMerchant(input: {
  telegramId: string;
  businessId: number;
  finikApiKey: unknown;
}): Promise<
  | { ok: true; finikConfigured: boolean }
  | { ok: false; statusCode: number; error: string }
> {
  const raw = typeof input.finikApiKey === "string" ? input.finikApiKey : "";
  const out = await savePlatformFinikForMerchant({
    telegramId: input.telegramId,
    businessId: input.businessId,
    finikApiKey: raw,
    ...(raw.trim() === "" ? { finikSecret: "" } : {}),
  });
  if (!out.ok) return out;
  return { ok: true, finikConfigured: out.finikConfigured };
}
