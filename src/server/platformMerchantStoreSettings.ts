import { prisma } from "./db.js";
import { merchantStoreEntitled } from "./subscriptionAccess.js";
import {
  isValidFinikAccountId,
  isValidFinikApiKey,
  isValidFinikSecret,
} from "../bot/saasRegistrationValidation.js";
import { parseFinikRegistrationFields } from "../shared/finikRegistration.js";
import {
  buildFinikWebhookUrl,
  finikHasAccountId,
  finikHasApiKey,
  finikHasSecret,
  isFinikCredentialsReady,
  isFinikLegacyHttpReady,
  isFinikPlatformManagedMerchantsEnabled,
  isMerchantFinikPlatformManaged,
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
import {
  businessAddressRowToPublic,
  parseBusinessAddressInput,
  type BusinessAddressPublic,
} from "../shared/businessAddress.js";
import {
  defaultMerchantDeliverySettings,
  parseMerchantDeliverySettings,
  type MerchantDeliverySettings,
} from "../shared/merchantDeliverySettings.js";
import {
  defaultStoreAvailabilitySettings,
  parseStoreAvailabilitySettings,
  type StoreAvailabilitySettings,
} from "../shared/storeAvailabilitySettings.js";
import { invalidateStorefrontCache } from "./storefrontCache.js";

export type PlatformStoreSettingsDTO = {
  businessId: number;
  name: string;
  /** @deprecated Используйте finikReady — оставлено для совместимости. */
  finikConfigured: boolean;
  finikReady: boolean;
  finikHasApiKey: boolean;
  finikHasAccountId: boolean;
  /** Legacy HTTP (до Phase 3). */
  finikLegacyHttpReady: boolean;
  finikHasSecret: boolean;
  /** Platform ENV signs payments; merchant stores Account ID only. */
  finikPlatformManaged: boolean;
  finikWebhookUrl: string | null;
  pendingBotTokenChange: boolean;
  businessType: string;
  merchantConfig: Record<string, unknown>;
  merchantSettingsSchema: Record<string, unknown>;
  subscriptionStatus: string;
  subscriptionEndsAt: string | null;
  trialEndsAt: string | null;
  storeAddress: BusinessAddressPublic | null;
  deliverySettings: MerchantDeliverySettings;
  storeAvailabilitySettings: StoreAvailabilitySettings;
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
      finikAccountId: true,
      finikSecret: true,
      businessType: true,
      merchantConfig: true,
      subscriptionStatus: true,
      subscriptionEndsAt: true,
      trialEndsAt: true,
      addressLine: true,
      city: true,
      latitude: true,
      longitude: true,
      deliverySettings: true,
      storeAvailabilitySettings: true,
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

  const platformManaged = isMerchantFinikPlatformManaged({
    finikApiKey: b.finikApiKey,
    finikAccountId: b.finikAccountId,
    finikSecret: b.finikSecret,
  });
  const ready = isFinikCredentialsReady(
    b.finikApiKey,
    b.finikAccountId,
    b.finikSecret,
  );
  const legacyHttpReady = isFinikLegacyHttpReady(b.finikApiKey, b.finikSecret);
  const origin = publicApiOrigin();

  return {
    ok: true,
    settings: {
      businessId: b.id,
      name: b.name,
      finikConfigured: ready,
      finikReady: ready,
      finikHasApiKey: finikHasApiKey(b.finikApiKey),
      finikHasAccountId: finikHasAccountId(b.finikAccountId),
      finikLegacyHttpReady: legacyHttpReady,
      finikHasSecret: finikHasSecret(b.finikSecret),
      finikPlatformManaged: platformManaged,
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
      storeAddress: businessAddressRowToPublic(b),
      deliverySettings: (() => {
        const p = parseMerchantDeliverySettings((b as any).deliverySettings);
        return p.ok ? p.value : defaultMerchantDeliverySettings();
      })(),
      storeAvailabilitySettings: (() => {
        const p = parseStoreAvailabilitySettings(
          (b as any).storeAvailabilitySettings,
          String((b as any).businessType ?? ""),
        );
        return p.ok ? p.value : defaultStoreAvailabilitySettings();
      })(),
    },
  };
}

export type PlatformStoreSettingsUpdateBody = {
  storeName?: unknown;
  finikApiKey?: unknown;
  finikAccountId?: unknown;
  newBotToken?: unknown;
  merchantConfig?: unknown;
  addressLine?: unknown;
  city?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  deliverySettings?: unknown;
  storeAvailabilitySettings?: unknown;
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
  const rawFinikAccount = input.body.finikAccountId;
  const rawTok = input.body.newBotToken;
  const rawMerchantConfig = input.body.merchantConfig;

  const hasName =
    rawName !== undefined &&
    !(typeof rawName === "string" && rawName.trim() === "");
  const hasFinik = rawFinik !== undefined;
  const hasFinikAccount = rawFinikAccount !== undefined;
  const hasTok =
    rawTok !== undefined &&
    !(typeof rawTok === "string" && rawTok.replace(/\s/g, "").trim() === "");
  const hasMerchantConfig = rawMerchantConfig !== undefined;
  const hasAddress =
    input.body.addressLine !== undefined ||
    input.body.city !== undefined ||
    input.body.latitude !== undefined ||
    input.body.longitude !== undefined;
  const hasDeliverySettings = input.body.deliverySettings !== undefined;
  const hasStoreAvailability = input.body.storeAvailabilitySettings !== undefined;

  if (
    !hasName &&
    !hasFinik &&
    !hasFinikAccount &&
    !hasTok &&
    !hasMerchantConfig &&
    !hasAddress &&
    !hasDeliverySettings &&
    !hasStoreAvailability
  ) {
    return {
      ok: false,
      statusCode: 400,
      error: "Нет данных для сохранения. Измените название, адрес, доставку или другие настройки.",
    };
  }

  if (hasDeliverySettings) {
    const parsed = parseMerchantDeliverySettings(input.body.deliverySettings);
    if (!parsed.ok) {
      return { ok: false, statusCode: 400, error: parsed.error };
    }
    await prisma.business.update({
      where: { id: input.businessId },
      data: { deliverySettings: parsed.value as any },
    });
    invalidateStorefrontCache(input.businessId);
  }

  if (hasStoreAvailability) {
    const bizTypeRow = await prisma.business.findUnique({
      where: { id: input.businessId },
      select: { businessType: true },
    });
    const parsed = parseStoreAvailabilitySettings(
      input.body.storeAvailabilitySettings,
      String(bizTypeRow?.businessType ?? ""),
    );
    if (!parsed.ok) {
      return { ok: false, statusCode: 400, error: parsed.error };
    }
    await prisma.business.update({
      where: { id: input.businessId },
      data: { storeAvailabilitySettings: parsed.value as any },
    });
    invalidateStorefrontCache(input.businessId);
  }

  if (hasAddress) {
    const addr = parseBusinessAddressInput({
      addressLine: input.body.addressLine,
      city: input.body.city,
      latitude: input.body.latitude,
      longitude: input.body.longitude,
    });
    if (!addr.ok) {
      return { ok: false, statusCode: 400, error: addr.error };
    }
    await prisma.business.update({
      where: { id: input.businessId },
      data: {
        addressLine: addr.value.addressLine,
        city: addr.value.city,
        latitude: addr.value.latitude,
        longitude: addr.value.longitude,
      },
    });
    invalidateStorefrontCache(input.businessId);
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

  if (hasFinik || hasFinikAccount) {
    const existing = await prisma.business.findUnique({
      where: { id: input.businessId },
      select: { finikApiKey: true, finikAccountId: true },
    });
    if (existing == null) {
      return { ok: false, statusCode: 404, error: "Магазин не найден" };
    }

    const nextKey = hasFinik
      ? typeof rawFinik === "string"
        ? rawFinik.trim()
        : ""
      : (existing.finikApiKey ?? "");
    const nextAccount = hasFinikAccount
      ? typeof rawFinikAccount === "string"
        ? rawFinikAccount.trim()
        : ""
      : (existing.finikAccountId ?? "");

    if (hasFinik && nextKey === "" && (!hasFinikAccount || nextAccount === "")) {
      await prisma.business.update({
        where: { id: input.businessId },
        data: { finikApiKey: null, finikAccountId: null, finikSecret: null },
      });
      await prisma.settings.updateMany({
        where: { businessId: input.businessId },
        data: { paymentProvider: null },
      });
    } else {
      const parsed = parseFinikRegistrationFields({
        finikApiKey: nextKey === "" ? null : nextKey,
        finikAccountId: nextAccount === "" ? null : nextAccount,
      });
      if (!parsed.ok) {
        return { ok: false, statusCode: 400, error: parsed.error };
      }
      if (parsed.skip) {
        await prisma.business.update({
          where: { id: input.businessId },
          data: { finikApiKey: null, finikAccountId: null, finikSecret: null },
        });
        await prisma.settings.updateMany({
          where: { businessId: input.businessId },
          data: { paymentProvider: null },
        });
      } else {
        await prisma.business.update({
          where: { id: input.businessId },
          data: {
            finikApiKey: parsed.finikApiKey ?? null,
            finikAccountId: parsed.finikAccountId,
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
    }
  }

  if (hasMerchantConfig) {
    const b = await prisma.business.findUnique({
      where: { id: input.businessId },
      select: { id: true, businessType: true },
    });
    const bt = (b as any)?.businessType;
    if (typeof bt !== "string" || bt.trim() === "") {
      return {
        ok: false,
        statusCode: 400,
        error: "Не удалось сохранить настройки магазина. Обратитесь в поддержку.",
      };
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

/** Сохранение Finik API Key, Account ID и опционально legacy Secret. */
export async function savePlatformFinikForMerchant(input: {
  telegramId: string;
  businessId: number;
  finikApiKey?: unknown;
  finikAccountId?: unknown;
  finikSecret?: unknown;
}): Promise<
  | {
      ok: true;
      finikConfigured: boolean;
      finikReady: boolean;
      finikHasApiKey: boolean;
      finikHasAccountId: boolean;
      finikLegacyHttpReady: boolean;
      finikHasSecret: boolean;
      finikPlatformManaged: boolean;
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
  const accountProvided = input.finikAccountId !== undefined;
  const secretProvided = input.finikSecret !== undefined;
  if (!keyProvided && !accountProvided && !secretProvided) {
    return {
      ok: false,
      statusCode: 400,
      error: isFinikPlatformManagedMerchantsEnabled()
        ? "Укажите Account ID Finik или очистите поле для отключения."
        : "Укажите API Key и Account ID Finik или очистите поля для отключения.",
    };
  }

  const existing = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: { finikApiKey: true, finikAccountId: true, finikSecret: true },
  });
  if (existing == null) {
    return { ok: false, statusCode: 404, error: "Магазин не найден" };
  }

  const keyRaw = keyProvided
    ? typeof input.finikApiKey === "string"
      ? input.finikApiKey.trim()
      : ""
    : null;
  const accountRaw = accountProvided
    ? typeof input.finikAccountId === "string"
      ? input.finikAccountId.trim()
      : ""
    : null;
  const secretRaw = secretProvided
    ? typeof input.finikSecret === "string"
      ? input.finikSecret.trim()
      : ""
    : null;

  const disconnect =
    isFinikPlatformManagedMerchantsEnabled() &&
    accountProvided &&
    accountRaw === "" &&
    !keyProvided &&
    !secretProvided
      ? true
      : keyProvided &&
        keyRaw === "" &&
        (!accountProvided || accountRaw === "") &&
        (!secretProvided || secretRaw === "");

  if (disconnect) {
    await prisma.business.update({
      where: { id: input.businessId },
      data: { finikApiKey: null, finikAccountId: null, finikSecret: null },
    });
    await prisma.settings.updateMany({
      where: { businessId: input.businessId },
      data: { paymentProvider: null },
    });
  } else {
    let nextKey = existing.finikApiKey;
    let nextAccount = existing.finikAccountId;
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

    if (accountProvided && accountRaw != null && accountRaw !== "") {
      if (!isValidFinikAccountId(accountRaw)) {
        return {
          ok: false,
          statusCode: 400,
          error: "Некорректный Account ID Finik",
        };
      }
      nextAccount = accountRaw;
    }

    if (secretProvided && secretRaw != null && secretRaw !== "") {
      if (!isValidFinikSecret(secretRaw)) {
        return {
          ok: false,
          statusCode: 400,
          error: "Некорректный Finik Secret (legacy)",
        };
      }
      nextSecret = secretRaw;
    }

    const platformManagedSave =
      isFinikPlatformManagedMerchantsEnabled() &&
      !finikHasApiKey(nextKey) &&
      !finikHasSecret(nextSecret);

    if (platformManagedSave) {
      if (!finikHasAccountId(nextAccount)) {
        return {
          ok: false,
          statusCode: 400,
          error: "Укажите Account ID Finik",
        };
      }
      nextKey = null;
      nextSecret = null;
    } else {
      if (!finikHasApiKey(nextKey)) {
        return {
          ok: false,
          statusCode: 400,
          error: "Укажите API Key Finik",
        };
      }
      if (!finikHasAccountId(nextAccount)) {
        return {
          ok: false,
          statusCode: 400,
          error: "Укажите Account ID Finik",
        };
      }
    }

    await prisma.business.update({
      where: { id: input.businessId },
      data: {
        finikApiKey: nextKey,
        finikAccountId: nextAccount,
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
    finikHasAccountId: s.finikHasAccountId,
    finikLegacyHttpReady: s.finikLegacyHttpReady,
    finikHasSecret: s.finikHasSecret,
    finikPlatformManaged: s.finikPlatformManaged,
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
    ...(raw.trim() === "" ? { finikAccountId: "", finikSecret: "" } : {}),
  });
  if (!out.ok) return out;
  return { ok: true, finikConfigured: out.finikConfigured };
}
