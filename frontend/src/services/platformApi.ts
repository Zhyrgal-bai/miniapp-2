import { apiAbsoluteUrl } from "./api";
import { adminFetch, adminFetchJson, adminFetchVoid } from "./adminRequest";

export type PlatformMyBusinessDTO = {
  id: number;
  name: string;
  slug: string | null;
  /** Серверное значение статуса (blocked, active, …) */
  status: string;
  isActive: boolean;
  isBlocked: boolean;
  subscriptionActive: boolean;
  subscriptionEndsAt: string | null;
  trialEndsAt: string | null;
  webhookStatus: "OK" | "ERROR";
  /** URL вебхука из Telegram (без токена бота). */
  webhookUrl: string | null;
};

export async function fetchPlatformMyBusinesses(params: {
  telegramId: number;
}): Promise<PlatformMyBusinessDTO[]> {
  void params.telegramId;
  const data = await adminFetchJson<unknown>(
    apiAbsoluteUrl("/api/platform/my-businesses"),
    { method: "GET", json: false },
  );
  if (!Array.isArray(data)) return [];
  const mapped = data.map((row) => {
    const x = row as Partial<PlatformMyBusinessDTO> & Pick<
      PlatformMyBusinessDTO,
      "id" | "name" | "status"
    >;
    const idNum =
      typeof x.id === "number" && Number.isFinite(x.id)
        ? Math.trunc(x.id)
        : Number(String(x.id ?? "").trim());
    const ws: PlatformMyBusinessDTO["webhookStatus"] =
      x.webhookStatus === "OK" ? "OK" : "ERROR";
    const wu =
      typeof x.webhookUrl === "string" && x.webhookUrl.trim() !== ""
        ? x.webhookUrl.trim()
        : null;
    const isActive = Boolean(x.isActive);
    const isBlocked = Boolean(x.isBlocked);
    const subEnd =
      typeof x.subscriptionEndsAt === "string" && x.subscriptionEndsAt.trim() !== ""
        ? x.subscriptionEndsAt.trim()
        : null;
    const trialEnd =
      typeof x.trialEndsAt === "string" && x.trialEndsAt.trim() !== ""
        ? x.trialEndsAt.trim()
        : null;
    const slugRaw =
      typeof x.slug === "string" && x.slug.trim() !== "" ? x.slug.trim() : null;
    return {
      id:
        typeof idNum === "number" &&
        Number.isInteger(idNum) &&
        idNum > 0
          ? idNum
          : 0,
      name: String(x.name ?? ""),
      slug: slugRaw,
      status: String(x.status ?? ""),
      isActive,
      isBlocked,
      subscriptionActive:
        typeof x.subscriptionActive === "boolean"
          ? x.subscriptionActive
          : isActive && !isBlocked,
      subscriptionEndsAt: subEnd,
      trialEndsAt: trialEnd,
      webhookStatus: ws,
      webhookUrl: wu,
    };
  });
  return mapped.filter((r) => r.id > 0);
}

export async function fetchPlatformWhoAmI(): Promise<{
  telegramId: string;
  isPlatformAdmin: boolean;
}> {
  const j = await adminFetchJson<{
    telegramId?: string;
    isPlatformAdmin?: boolean;
  }>(apiAbsoluteUrl("/api/platform/admin/whoami"), {
    method: "GET",
    json: false,
  });
  const tid = typeof j.telegramId === "string" ? j.telegramId.trim() : "";
  if (tid === "") {
    throw new Error("Некорректный ответ сервера");
  }
  return {
    telegramId: tid,
    isPlatformAdmin: Boolean(j.isPlatformAdmin),
  };
}

export async function fetchOperatorCapabilities(): Promise<{
  isOperatorIdentity: boolean;
  canShowOperatorEntry: boolean;
}> {
  const j = await adminFetchJson<{
    isOperatorIdentity?: boolean;
    canShowOperatorEntry?: boolean;
  }>(apiAbsoluteUrl("/api/platform/operator/capabilities"), {
    method: "GET",
    json: false,
  });
  return {
    isOperatorIdentity: Boolean(j.isOperatorIdentity),
    canShowOperatorEntry: Boolean(j.canShowOperatorEntry),
  };
}

export async function postOperatorUnlock(password: string): Promise<{
  token: string;
  expiresAt: string;
}> {
  const j = await adminFetchJson<{ token?: string; expiresAt?: string }>(
    apiAbsoluteUrl("/api/platform/operator/unlock"),
    {
      method: "POST",
      body: JSON.stringify({ password }),
    },
  );
  if (typeof j.token !== "string" || typeof j.expiresAt !== "string") {
    throw new Error("Некорректный ответ сервера");
  }
  return {
    token: j.token,
    expiresAt: j.expiresAt,
  };
}

export async function postOperatorLock(token: string): Promise<void> {
  await adminFetch(apiAbsoluteUrl("/api/platform/operator/lock"), {
    method: "POST",
    headers: { "x-operator-session": token },
    body: JSON.stringify({}),
  });
}

export async function postOperatorReauth(
  token: string,
  password: string,
): Promise<void> {
  await adminFetch(apiAbsoluteUrl("/api/platform/operator/reauth"), {
    method: "POST",
    headers: { "x-operator-session": token },
    body: JSON.stringify({ password }),
  });
}

export type PlatformSubscriptionPaymentResult = {
  paymentUrl: string;
  subscriptionPaymentId: number;
  planCode: MerchantSubscriptionPlanCode;
  planDays: number;
  accessDaysGranted: number;
  amountSom: number;
};

export async function postPlatformSubscriptionPaymentCreate(params: {
  telegramId: number;
  businessId: number;
  planCode: MerchantSubscriptionPlanCode;
}): Promise<PlatformSubscriptionPaymentResult> {
  void params.telegramId;
  const j = await adminFetchJson<{
    error?: string;
    paymentUrl?: string;
    subscriptionPaymentId?: number;
    planCode?: string;
    planDays?: number;
    accessDaysGranted?: number;
    amountSom?: number;
  }>(apiAbsoluteUrl("/api/platform/subscription-payment/create"), {
    method: "POST",
    businessId: params.businessId,
    body: JSON.stringify({
      businessId: params.businessId,
      planCode: params.planCode,
    }),
  });
  const code = j.planCode;
  if (
    typeof j.paymentUrl === "string" &&
    j.paymentUrl.trim() !== "" &&
    typeof j.subscriptionPaymentId === "number" &&
    (code === "FIRST_MONTH" ||
      code === "MONTHLY" ||
      code === "THREE_MONTH" ||
      code === "YEARLY") &&
    typeof j.amountSom === "number"
  ) {
    return {
      paymentUrl: j.paymentUrl.trim(),
      subscriptionPaymentId: j.subscriptionPaymentId,
      planCode: code,
      planDays: typeof j.planDays === "number" ? j.planDays : 0,
      accessDaysGranted:
        typeof j.accessDaysGranted === "number"
          ? j.accessDaysGranted
          : typeof j.planDays === "number"
            ? j.planDays
            : 0,
      amountSom: j.amountSom,
    };
  }
  throw new Error(j.error ?? "Некорректный ответ сервера");
}

export async function postPlatformSubscriptionPaymentCancel(params: {
  businessId: number;
}): Promise<void> {
  const j = await adminFetchJson<{ success?: boolean; error?: string }>(
    apiAbsoluteUrl("/api/platform/subscription-payment/cancel"),
    {
      method: "POST",
      businessId: params.businessId,
      body: JSON.stringify({ businessId: params.businessId }),
    },
  );
  if (j.success !== true) {
    throw new Error(j.error ?? "Не удалось отменить счёт");
  }
}

export type MerchantSubscriptionUiStatus =
  | "ACTIVE"
  | "TRIAL"
  | "FREE"
  | "QUOTA_EXHAUSTED"
  | "GRACE"
  | "EXPIRED"
  | "EXPIRING"
  | "PENDING_PAYMENT";

export type MerchantSubscriptionPlanCode =
  | "FIRST_MONTH"
  | "MONTHLY"
  | "THREE_MONTH"
  | "YEARLY";

export type MerchantSubscriptionPlanDTO = {
  code: MerchantSubscriptionPlanCode;
  title: string;
  subtitle: string;
  paidMonths: number;
  bonusMonths: number;
  bonusDays: number;
  totalMonths: number;
  amountSom: number;
  badge?: string;
  featured?: boolean;
  popular?: boolean;
};

export type SubscriptionHistoryEntryType = "finik_payment" | "operator_extension";

export type SubscriptionPaymentHistoryRow = {
  id: string | number;
  entryType?: SubscriptionHistoryEntryType;
  createdAt: string;
  amountSom: number | null;
  planCode: string | null;
  planLabel: string;
  status: string;
  finikPaymentId: string | null;
  source: string;
  accessDaysGranted?: number | null;
};

export type MerchantSubscriptionPanelPayload = {
  businessId: number;
  displayStatus: MerchantSubscriptionUiStatus;
  displayStatusLabel: string;
  accessMode?: string;
  subscriptionStatus: string;
  subscriptionPlanCode: string | null;
  subscriptionPlanLabel: string;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  gracePeriodEndsAt: string | null;
  freeOrdersUsed?: number;
  freeOrdersLimit?: number;
  freeOrdersRemaining?: number;
  daysLeft: number | null;
  countdownMs: number | null;
  inGracePeriod: boolean;
  autoRenewEnabled: boolean;
  storeOpenForCustomers: boolean;
  isBlocked: boolean;
  isActive: boolean;
  platformFinikReady: boolean;
  platformFinikPayReady: boolean;
  canPay: boolean;
  isOwner: boolean;
  firstMonthEligible: boolean;
  hasPendingPayment: boolean;
  pendingPayment: {
    id: number;
    planCode: string | null;
    planLabel: string;
    amountSom: number;
    createdAt: string;
  } | null;
  plans: MerchantSubscriptionPlanDTO[];
};

export async function fetchMerchantSubscriptionPanel(
  businessId: number,
): Promise<MerchantSubscriptionPanelPayload> {
  const url = new URL(apiAbsoluteUrl("/api/platform/subscription"));
  url.searchParams.set("businessId", String(businessId));
  const j = await adminFetchJson<MerchantSubscriptionPanelPayload>(
    url.toString(),
    { method: "GET", businessId, json: false },
  );
  if (
    typeof j.businessId !== "number" ||
    (j.displayStatus !== "ACTIVE" &&
      j.displayStatus !== "TRIAL" &&
      j.displayStatus !== "FREE" &&
      j.displayStatus !== "QUOTA_EXHAUSTED" &&
      j.displayStatus !== "EXPIRED" &&
      j.displayStatus !== "GRACE" &&
      j.displayStatus !== "EXPIRING" &&
      j.displayStatus !== "PENDING_PAYMENT")
  ) {
    throw new Error("Некорректный ответ сервера");
  }
  return j;
}

export async function fetchSubscriptionPaymentHistory(
  businessId: number,
): Promise<SubscriptionPaymentHistoryRow[]> {
  const url = new URL(apiAbsoluteUrl("/api/platform/subscription/payments"));
  url.searchParams.set("businessId", String(businessId));
  const j = await adminFetchJson<{
    entries?: SubscriptionPaymentHistoryRow[];
    payments?: SubscriptionPaymentHistoryRow[];
  }>(url.toString(), { method: "GET", businessId, json: false });
  const rows = j.entries ?? j.payments;
  return Array.isArray(rows) ? rows : [];
}

export async function patchSubscriptionAutoRenew(params: {
  businessId: number;
  enabled: boolean;
}): Promise<boolean> {
  const j = await adminFetchJson<{ autoRenewEnabled?: boolean }>(
    apiAbsoluteUrl("/api/platform/subscription/auto-renew"),
    {
      method: "PATCH",
      businessId: params.businessId,
      body: JSON.stringify({
        businessId: params.businessId,
        enabled: params.enabled,
      }),
    },
  );
  return Boolean(j.autoRenewEnabled);
}

export type BusinessStoreAddressDTO = {
  addressLine: string;
  city: string;
  latitude: number;
  longitude: number;
};

export type MerchantDeliverySettingsDTO = {
  version: 1;
  pricingMode:
    | "SELF_PICKUP"
    | "FIXED_PRICE"
    | "DISTANCE_BASED"
    | "FREE_DELIVERY"
    | "MANUAL_CONFIRMATION"
    | "REGION_BASED";
  minOrderAmountSom: number;
  fixedPriceSom: number;
  distanceTiers: Array<{ maxKm: number | null; priceSom: number }>;
  regions: Array<{ id: string; name: string; priceSom: number; notes?: string | null }>;
  merchantDeliveryEnabled: boolean;
};

import type { MerchantDeliveryProviderPolicy } from "../types/deliveryAdmin.types";
import { defaultMerchantDeliveryProviderPolicy } from "../types/deliveryAdmin.types";
import type { StoreAvailabilitySettings } from "@repo-shared/storeAvailabilitySettings";
import {
  defaultStoreAvailabilitySettings,
  parseStoreAvailabilitySettings,
} from "@repo-shared/storeAvailabilitySettings";

export type {
  StoreAvailabilitySettings,
  PublicStoreAvailability,
} from "@repo-shared/storeAvailabilitySettings";

export type PlatformStoreSettingsDTO = {
  businessId: number;
  name: string;
  storeAddress: BusinessStoreAddressDTO | null;
  deliverySettings: MerchantDeliverySettingsDTO;
  deliveryProviderPolicy: MerchantDeliveryProviderPolicy;
  storeAvailabilitySettings: StoreAvailabilitySettings;
  finikConfigured: boolean;
  finikReady: boolean;
  finikHasApiKey: boolean;
  finikHasAccountId: boolean;
  finikLegacyHttpReady: boolean;
  finikHasSecret: boolean;
  finikPlatformManaged: boolean;
  finikWebhookUrl: string | null;
  pendingBotTokenChange: boolean;
  businessType: string;
  merchantConfig: Record<string, unknown>;
  merchantSettingsSchema: Record<string, unknown>;
  subscriptionStatus: string;
  subscriptionEndsAt: string | null;
  trialEndsAt: string | null;
};

export async function fetchPlatformStoreSettings(params: {
  telegramId: number;
  businessId: number;
}): Promise<PlatformStoreSettingsDTO> {
  void params.telegramId;
  const q = new URLSearchParams({
    businessId: String(params.businessId),
  });
  const j = await adminFetchJson<{
    error?: string;
    businessId?: number;
    name?: string;
    finikConfigured?: boolean;
    finikReady?: boolean;
    finikHasApiKey?: boolean;
    finikHasAccountId?: boolean;
    finikLegacyHttpReady?: boolean;
    finikHasSecret?: boolean;
    finikPlatformManaged?: boolean;
    finikWebhookUrl?: string | null;
    pendingBotTokenChange?: boolean;
    businessType?: unknown;
    merchantConfig?: unknown;
    merchantSettingsSchema?: unknown;
    subscriptionStatus?: unknown;
    subscriptionEndsAt?: unknown;
    trialEndsAt?: unknown;
    storeAddress?: {
      addressLine?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
    } | null;
    deliverySettings?: MerchantDeliverySettingsDTO;
    storeAvailabilitySettings?: StoreAvailabilitySettings;
  }>(
    apiAbsoluteUrl(`/api/platform/store-settings?${q.toString()}`),
    { method: "GET", businessId: params.businessId, json: false },
  );
  const bid =
    typeof j.businessId === "number" && Number.isInteger(j.businessId)
      ? j.businessId
      : 0;
  if (bid <= 0) {
    throw new Error("Некорректный ответ сервера");
  }
  const finikReady =
    typeof j.finikReady === "boolean"
      ? j.finikReady
      : Boolean(j.finikConfigured);
  let storeAddress: BusinessStoreAddressDTO | null = null;
  const sa = j.storeAddress;
  if (
    sa != null &&
    typeof sa === "object" &&
    typeof sa.addressLine === "string" &&
    typeof sa.city === "string" &&
    typeof sa.latitude === "number" &&
    Number.isFinite(sa.latitude) &&
    typeof sa.longitude === "number" &&
    Number.isFinite(sa.longitude)
  ) {
    storeAddress = {
      addressLine: sa.addressLine.trim(),
      city: sa.city.trim(),
      latitude: sa.latitude,
      longitude: sa.longitude,
    };
  }
  const defaultDelivery: MerchantDeliverySettingsDTO = {
    version: 1,
    pricingMode: "REGION_BASED",
    minOrderAmountSom: 0,
    fixedPriceSom: 0,
    distanceTiers: [],
    regions: [],
    merchantDeliveryEnabled: true,
  };
  const ds = j.deliverySettings;
  const deliverySettings: MerchantDeliverySettingsDTO =
    ds != null &&
    typeof ds === "object" &&
    typeof ds.pricingMode === "string" &&
    typeof ds.minOrderAmountSom === "number"
      ? {
          version: 1,
          pricingMode: ds.pricingMode as MerchantDeliverySettingsDTO["pricingMode"],
          minOrderAmountSom: Math.max(0, Math.round(ds.minOrderAmountSom)),
          fixedPriceSom: Math.max(0, Math.round(Number(ds.fixedPriceSom) || 0)),
          distanceTiers: Array.isArray(ds.distanceTiers)
            ? ds.distanceTiers
                .map((t) => {
                  if (t == null || typeof t !== "object") return null;
                  const maxKm =
                    (t as { maxKm?: number | null }).maxKm ?? null;
                  const priceSom = Number((t as { priceSom?: number }).priceSom);
                  if (!Number.isFinite(priceSom)) return null;
                  return {
                    maxKm:
                      maxKm != null && Number.isFinite(Number(maxKm))
                        ? Number(maxKm)
                        : null,
                    priceSom: Math.max(0, Math.round(priceSom)),
                  };
                })
                .filter((x): x is { maxKm: number | null; priceSom: number } => x != null)
            : [],
          regions: Array.isArray((ds as { regions?: unknown }).regions)
            ? (ds as { regions: unknown[] }).regions
                .map((r) => {
                  if (r == null || typeof r !== "object") return null;
                  const row = r as {
                    id?: string;
                    name?: string;
                    priceSom?: number;
                    notes?: string | null;
                  };
                  const name = String(row.name ?? "").trim();
                  if (name.length < 2) return null;
                  const priceSom = Number(row.priceSom);
                  if (!Number.isFinite(priceSom)) return null;
                  return {
                    id: String(row.id ?? name).trim() || name,
                    name,
                    priceSom: Math.max(0, Math.round(priceSom)),
                    notes:
                      typeof row.notes === "string" && row.notes.trim() !== ""
                        ? row.notes.trim()
                        : null,
                  };
                })
                .filter(
                  (x): x is {
                    id: string;
                    name: string;
                    priceSom: number;
                    notes: string | null;
                  } => x != null,
                )
            : [],
          merchantDeliveryEnabled:
            (ds as { merchantDeliveryEnabled?: boolean }).merchantDeliveryEnabled !== false,
        }
      : defaultDelivery;
  const policyRaw = (j as { deliveryProviderPolicy?: unknown }).deliveryProviderPolicy;
  const deliveryProviderPolicy: MerchantDeliveryProviderPolicy =
    policyRaw != null && typeof policyRaw === "object"
      ? {
          ...defaultMerchantDeliveryProviderPolicy(),
          ...(policyRaw as MerchantDeliveryProviderPolicy),
        }
      : defaultMerchantDeliveryProviderPolicy();
  const availParsed = parseStoreAvailabilitySettings(
    j.storeAvailabilitySettings,
    typeof j.businessType === "string" ? j.businessType : "",
  );
  const storeAvailabilitySettings = availParsed.ok
    ? availParsed.value
    : defaultStoreAvailabilitySettings();
  return {
    businessId: bid,
    name: String(j.name ?? ""),
    storeAddress,
    deliverySettings,
    deliveryProviderPolicy,
    storeAvailabilitySettings,
    finikConfigured: finikReady,
    finikReady,
    finikHasApiKey: Boolean(j.finikHasApiKey ?? finikReady),
    finikHasAccountId: Boolean(j.finikHasAccountId),
    finikLegacyHttpReady: Boolean(j.finikLegacyHttpReady),
    finikHasSecret: Boolean(j.finikHasSecret),
    finikPlatformManaged: Boolean(j.finikPlatformManaged),
    finikWebhookUrl:
      typeof j.finikWebhookUrl === "string" && j.finikWebhookUrl.trim() !== ""
        ? j.finikWebhookUrl.trim()
        : null,
    pendingBotTokenChange: Boolean(j.pendingBotTokenChange),
    businessType: typeof j.businessType === "string" ? j.businessType : "",
    merchantConfig:
      j.merchantConfig != null &&
      typeof j.merchantConfig === "object" &&
      !Array.isArray(j.merchantConfig)
        ? (j.merchantConfig as Record<string, unknown>)
        : {},
    merchantSettingsSchema:
      j.merchantSettingsSchema != null &&
      typeof j.merchantSettingsSchema === "object" &&
      !Array.isArray(j.merchantSettingsSchema)
        ? (j.merchantSettingsSchema as Record<string, unknown>)
        : {},
    subscriptionStatus:
      typeof j.subscriptionStatus === "string" ? j.subscriptionStatus : "",
    subscriptionEndsAt:
      typeof j.subscriptionEndsAt === "string" && j.subscriptionEndsAt.trim() !== ""
        ? j.subscriptionEndsAt.trim()
        : null,
    trialEndsAt:
      typeof j.trialEndsAt === "string" && j.trialEndsAt.trim() !== ""
        ? j.trialEndsAt.trim()
        : null,
  };
}

export type PlatformStoreSettingsSaveResult = {
  ok: true;
  name: string;
  finikConfigured: boolean;
  pendingBotTokenChange: boolean;
  botTokenChangeRequestId?: number;
  botTokenApplied?: boolean;
  botUsername?: string | null;
};

export type MerchantBotTokenApplyResult = {
  ok: true;
  botUsername: string | null;
  botStatus: MerchantBotRecoveryPayload | null;
};

export async function postMerchantBotToken(payload: {
  telegramId: number;
  businessId: number;
  newBotToken: string;
}): Promise<MerchantBotTokenApplyResult> {
  void payload.telegramId;
  const j = await adminFetchJson<{
    ok?: boolean;
    error?: string;
    botUsername?: string | null;
    botStatus?: unknown;
  }>(apiAbsoluteUrl("/api/platform/merchant-bot-token"), {
    method: "POST",
    businessId: payload.businessId,
    body: JSON.stringify({
      businessId: payload.businessId,
      newBotToken: payload.newBotToken,
    }),
  });
  if (j.ok !== true) {
    throw new Error(
      typeof j.error === "string" && j.error.trim() !== ""
        ? j.error
        : "Не удалось сохранить токен",
    );
  }
  const botStatus = parseMerchantBotRecoveryPayload(j.botStatus);
  return {
    ok: true,
    botUsername:
      typeof j.botUsername === "string" ? j.botUsername.trim() || null : null,
    botStatus,
  };
}

export async function savePlatformStoreSettings(payload: {
  telegramId: number;
  businessId: number;
  storeName?: string;
  newBotToken?: string;
  merchantConfig?: Record<string, unknown>;
  addressLine?: string;
  city?: string;
  latitude?: number | string;
  longitude?: number | string;
  deliverySettings?: MerchantDeliverySettingsDTO;
  storeAvailabilitySettings?: StoreAvailabilitySettings;
}): Promise<PlatformStoreSettingsSaveResult> {
  void payload.telegramId;
  const body: Record<string, unknown> = {
    businessId: payload.businessId,
  };
  if (payload.storeName !== undefined) body.storeName = payload.storeName;
  if (payload.newBotToken !== undefined) body.newBotToken = payload.newBotToken;
  if (payload.merchantConfig !== undefined)
    body.merchantConfig = payload.merchantConfig;
  if (payload.addressLine !== undefined) body.addressLine = payload.addressLine;
  if (payload.city !== undefined) body.city = payload.city;
  if (payload.latitude !== undefined) body.latitude = payload.latitude;
  if (payload.longitude !== undefined) body.longitude = payload.longitude;
  if (payload.deliverySettings !== undefined)
    body.deliverySettings = payload.deliverySettings;
  if (payload.storeAvailabilitySettings !== undefined)
    body.storeAvailabilitySettings = payload.storeAvailabilitySettings;

  const j = await adminFetchJson<{
    error?: string;
    ok?: boolean;
    name?: string;
    finikConfigured?: boolean;
    finikReady?: boolean;
    finikHasApiKey?: boolean;
    finikHasAccountId?: boolean;
    finikLegacyHttpReady?: boolean;
    finikHasSecret?: boolean;
    finikWebhookUrl?: string | null;
    pendingBotTokenChange?: boolean;
    botTokenChangeRequestId?: number;
    botTokenApplied?: boolean;
    botUsername?: string | null;
  }>(apiAbsoluteUrl("/api/platform/store-settings"), {
    method: "POST",
    businessId: payload.businessId,
    body: JSON.stringify(body),
  });
  if (j.ok !== true) {
    throw new Error(j.error ?? "Некорректный ответ сервера");
  }
  return {
    ok: true,
    name: String(j.name ?? ""),
    finikConfigured: Boolean(j.finikConfigured),
    pendingBotTokenChange: Boolean(j.pendingBotTokenChange),
    ...(typeof j.botTokenChangeRequestId === "number"
      ? { botTokenChangeRequestId: j.botTokenChangeRequestId }
      : {}),
    ...(j.botTokenApplied === true
      ? {
          botTokenApplied: true,
          botUsername:
            typeof j.botUsername === "string" ? j.botUsername.trim() || null : null,
        }
      : {}),
  };
}

export type PlatformFinikSaveResult = {
  ok: true;
  finikConfigured: boolean;
  finikReady: boolean;
  finikHasApiKey: boolean;
  finikHasAccountId: boolean;
  finikLegacyHttpReady: boolean;
  finikHasSecret: boolean;
  finikPlatformManaged: boolean;
  finikWebhookUrl: string | null;
};

export async function postPlatformUpdateFinik(payload: {
  telegramId: number;
  businessId: number;
  finikApiKey?: string;
  finikAccountId: string;
  finikSecret?: string;
}): Promise<PlatformFinikSaveResult> {
  void payload.telegramId;
  const j = await adminFetchJson<{
    error?: string;
    ok?: boolean;
    finikConfigured?: boolean;
    finikReady?: boolean;
    finikHasApiKey?: boolean;
    finikHasAccountId?: boolean;
    finikLegacyHttpReady?: boolean;
    finikHasSecret?: boolean;
    finikPlatformManaged?: boolean;
    finikWebhookUrl?: string | null;
  }>(apiAbsoluteUrl("/api/platform/update-finik"), {
    method: "POST",
    businessId: payload.businessId,
    body: JSON.stringify({
      businessId: payload.businessId,
      ...(payload.finikApiKey !== undefined
        ? { finikApiKey: payload.finikApiKey }
        : {}),
      finikAccountId: payload.finikAccountId,
      ...(payload.finikSecret !== undefined && payload.finikSecret !== ""
        ? { finikSecret: payload.finikSecret }
        : {}),
    }),
  });
  if (j.ok !== true) {
    throw new Error(j.error ?? "Некорректный ответ сервера");
  }
  const finikReady =
    typeof j.finikReady === "boolean"
      ? j.finikReady
      : Boolean(j.finikConfigured);
  return {
    ok: true,
    finikConfigured: finikReady,
    finikReady,
    finikHasApiKey: Boolean(j.finikHasApiKey),
    finikHasAccountId: Boolean(j.finikHasAccountId),
    finikLegacyHttpReady: Boolean(j.finikLegacyHttpReady),
    finikHasSecret: Boolean(j.finikHasSecret),
    finikPlatformManaged: Boolean(j.finikPlatformManaged),
    finikWebhookUrl:
      typeof j.finikWebhookUrl === "string" && j.finikWebhookUrl.trim() !== ""
        ? j.finikWebhookUrl.trim()
        : null,
  };
}

export async function submitPlatformRegisterRequest(payload: {
  storeName: string;
  addressLine: string;
  city: string;
  latitude: number | string;
  longitude: number | string;
  botToken: string;
  phone: string;
  telegramId: number;
  businessType:
    | "clothing"
    | "coffee"
    | "fastfood"
    | "flowers"
    | "electronics"
    | "autoparts"
    | "cosmetics"
    | "furniture";
  ownerUsername?: string;
  finikApiKey?: string;
  finikAccountId?: string;
}): Promise<void> {
  void payload.telegramId;
  const body: Record<string, unknown> = {
    storeName: payload.storeName,
    addressLine: payload.addressLine,
    city: payload.city,
    latitude: payload.latitude,
    longitude: payload.longitude,
    botToken: payload.botToken,
    phone: payload.phone,
    telegramId: payload.telegramId,
    businessType: payload.businessType,
    ownerUsername: payload.ownerUsername,
  };
  if (payload.finikApiKey != null && payload.finikApiKey.trim() !== "") {
    body.finikApiKey = payload.finikApiKey.trim();
  }
  if (payload.finikAccountId != null && payload.finikAccountId.trim() !== "") {
    body.finikAccountId = payload.finikAccountId.trim();
  }
  await adminFetchVoid(apiAbsoluteUrl("/api/platform/register-request"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type RegistrationStatusPayload = {
  status: "none" | "pending" | "rejected" | "has_stores";
  requestId?: number;
  storeName?: string;
  businessType?: string;
  rejectReason?: string;
  createdAt?: string;
};

export async function fetchRegistrationStatus(): Promise<RegistrationStatusPayload> {
  return adminFetchJson<RegistrationStatusPayload>(
    apiAbsoluteUrl("/api/platform/registration-status"),
    { method: "GET", json: false },
  );
}

export async function postPlatformCheckWebhook(params: {
  telegramId: number;
  businessId: number;
}): Promise<{ status: "OK" | "ERROR"; lastErrorMessage: string | null }> {
  void params.telegramId;
  const j = await adminFetchJson<{
    error?: string;
    status?: string;
    lastErrorMessage?: string | null;
  }>(apiAbsoluteUrl("/api/platform/check-webhook"), {
    method: "POST",
    businessId: params.businessId,
    body: JSON.stringify({ businessId: params.businessId }),
  });
  const status = j.status === "OK" || j.status === "ERROR" ? j.status : null;
  if (status == null) {
    throw new Error("Некорректный ответ сервера");
  }
  return {
    status,
    lastErrorMessage:
      j.lastErrorMessage == null ? null : String(j.lastErrorMessage),
  };
}

export async function postPlatformToggleBot(params: {
  telegramId: number;
  businessId: number;
  action: "enable" | "disable";
}): Promise<{ ok: boolean; isActive: boolean }> {
  void params.telegramId;
  const j = await adminFetchJson<{
    error?: string;
    ok?: boolean;
    isActive?: boolean;
  }>(apiAbsoluteUrl("/api/platform/toggle-bot"), {
    method: "POST",
    businessId: params.businessId,
    body: JSON.stringify({
      businessId: params.businessId,
      action: params.action,
    }),
  });
  if (
    typeof j.ok !== "boolean" ||
    typeof j.isActive !== "boolean"
  ) {
    throw new Error("Некорректный ответ сервера");
  }
  return { ok: j.ok, isActive: j.isActive };
}

export type LaunchWizardStepId =
  | "subscription"
  | "telegram_bot"
  | "finik"
  | "product"
  | "storefront"
  | "test_order";

export type LaunchWizardStep = {
  id: LaunchWizardStepId;
  label: string;
  done: boolean;
  hint: string;
};

export type LaunchWizardPayload = {
  complete: boolean;
  completedCount: number;
  totalSteps: number;
  currentStepIndex: number;
  steps: LaunchWizardStep[];
};

export type TemplateRolloutSafetyPayload = {
  stage: "compatibility" | "migration" | "decommission";
  totalBusinesses: number;
  universalBusinesses: number;
  universalShare: number;
  canDecommissionUniversal: boolean;
};

export async function fetchTemplateRolloutSafety(): Promise<TemplateRolloutSafetyPayload> {
  const j = await adminFetchJson<TemplateRolloutSafetyPayload>(
    apiAbsoluteUrl("/api/platform/admin/template-rollout-safety"),
    { method: "GET", json: false },
  );
  return {
    stage:
      j.stage === "migration" || j.stage === "decommission"
        ? j.stage
        : "compatibility",
    totalBusinesses: Number(j.totalBusinesses ?? 0),
    universalBusinesses: Number(j.universalBusinesses ?? 0),
    universalShare: Number(j.universalShare ?? 0),
    canDecommissionUniversal: Boolean(j.canDecommissionUniversal),
  };
}

export type TemplateRiskControlsPayload = {
  generatedAt: string;
  checkpoints: Array<{ id: string; ok: boolean; detail: string }>;
  rollbackPlan: string[];
};

export async function fetchTemplateRiskControls(): Promise<TemplateRiskControlsPayload> {
  const j = await adminFetchJson<TemplateRiskControlsPayload>(
    apiAbsoluteUrl("/api/platform/admin/template-risk-controls"),
    { method: "GET", json: false },
  );
  return {
    generatedAt: typeof j.generatedAt === "string" ? j.generatedAt : "",
    checkpoints: Array.isArray(j.checkpoints) ? j.checkpoints : [],
    rollbackPlan: Array.isArray(j.rollbackPlan) ? j.rollbackPlan : [],
  };
}

export type StoreReadinessPayload = {
  score: number;
  maxScore: number;
  checklist: Array<{
    id: string;
    label: string;
    done: boolean;
    weight: number;
    href?: string;
  }>;
  recommendations: string[];
  launchWizard?: LaunchWizardPayload;
};

function parseLaunchWizard(raw: unknown): LaunchWizardPayload | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const w = raw as Record<string, unknown>;
  const stepsRaw = w.steps;
  if (!Array.isArray(stepsRaw)) return undefined;
  const ids = new Set<LaunchWizardStepId>([
    "subscription",
    "telegram_bot",
    "finik",
    "product",
    "storefront",
    "test_order",
  ]);
  const steps: LaunchWizardStep[] = [];
  for (const row of stepsRaw) {
    if (row == null || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = r.id;
    if (typeof id !== "string" || !ids.has(id as LaunchWizardStepId)) continue;
    steps.push({
      id: id as LaunchWizardStepId,
      label: typeof r.label === "string" ? r.label : "",
      done: Boolean(r.done),
      hint: typeof r.hint === "string" ? r.hint : "",
    });
  }
  if (steps.length === 0) return undefined;
  const completedCount =
    typeof w.completedCount === "number"
      ? w.completedCount
      : steps.filter((s) => s.done).length;
  const totalSteps =
    typeof w.totalSteps === "number" ? w.totalSteps : steps.length;
  const currentStepIndex =
    typeof w.currentStepIndex === "number"
      ? w.currentStepIndex
      : steps.findIndex((s) => !s.done);
  return {
    complete: Boolean(w.complete),
    completedCount,
    totalSteps,
    currentStepIndex,
    steps,
  };
}

export type MerchantBotStatusCode =
  | "connected"
  | "webhook_error"
  | "token_error"
  | "not_configured";

export type MerchantBotRecoveryPayload = {
  status: MerchantBotStatusCode;
  label: string;
  detail: string | null;
  webhookUrl: string | null;
  botUsername: string | null;
  isActive: boolean;
  isBlocked: boolean;
  botInMemory: boolean;
  publicApiConfigured: boolean;
};

function parseMerchantBotRecoveryPayload(
  raw: unknown,
): MerchantBotRecoveryPayload | null {
  if (raw == null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const status = r.status;
  const codes: MerchantBotStatusCode[] = [
    "connected",
    "webhook_error",
    "token_error",
    "not_configured",
  ];
  if (typeof status !== "string" || !codes.includes(status as MerchantBotStatusCode)) {
    return null;
  }
  return {
    status: status as MerchantBotStatusCode,
    label: typeof r.label === "string" ? r.label : "",
    detail:
      typeof r.detail === "string" && r.detail.trim() !== ""
        ? r.detail.trim()
        : null,
    webhookUrl:
      typeof r.webhookUrl === "string" && r.webhookUrl.trim() !== ""
        ? r.webhookUrl.trim()
        : null,
    botUsername:
      typeof r.botUsername === "string" && r.botUsername.trim() !== ""
        ? r.botUsername.trim()
        : null,
    isActive: Boolean(r.isActive),
    isBlocked: Boolean(r.isBlocked),
    botInMemory: Boolean(r.botInMemory),
    publicApiConfigured: Boolean(r.publicApiConfigured),
  };
}

export async function fetchMerchantBotStatus(
  businessId: number,
): Promise<MerchantBotRecoveryPayload> {
  const url = new URL(apiAbsoluteUrl("/api/platform/merchant-bot-status"));
  url.searchParams.set("businessId", String(businessId));
  const j = await adminFetchJson<unknown>(url.toString(), {
    method: "GET",
    businessId,
    json: false,
  });
  const parsed = parseMerchantBotRecoveryPayload(j);
  if (parsed == null) {
    throw new Error("Некорректный ответ сервера");
  }
  return parsed;
}

export async function postMerchantBotCheck(
  businessId: number,
): Promise<MerchantBotRecoveryPayload> {
  const j = await adminFetchJson<unknown>(
    apiAbsoluteUrl("/api/platform/merchant-bot-check"),
    {
      method: "POST",
      businessId,
      body: JSON.stringify({ businessId }),
    },
  );
  const parsed = parseMerchantBotRecoveryPayload(j);
  if (parsed == null) {
    throw new Error("Некорректный ответ сервера");
  }
  return parsed;
}

export async function postMerchantBotReconnect(
  businessId: number,
): Promise<MerchantBotRecoveryPayload> {
  const j = await adminFetchJson<{ ok?: boolean; status?: unknown; error?: string }>(
    apiAbsoluteUrl("/api/platform/merchant-bot-reconnect"),
    {
      method: "POST",
      businessId,
      body: JSON.stringify({ businessId }),
    },
  );
  if (j.ok !== true) {
    throw new Error(
      typeof j.error === "string" && j.error.trim() !== ""
        ? j.error
        : "Не удалось переподключить бота",
    );
  }
  const parsed = parseMerchantBotRecoveryPayload(j.status);
  if (parsed == null) {
    throw new Error("Некорректный ответ сервера");
  }
  return parsed;
}

export async function fetchStoreReadiness(
  businessId: number,
): Promise<StoreReadinessPayload> {
  const url = new URL(apiAbsoluteUrl("/api/platform/store-readiness"));
  url.searchParams.set("businessId", String(businessId));
  const j = await adminFetchJson<StoreReadinessPayload & { launchWizard?: unknown }>(
    url.toString(),
    {
      method: "GET",
      businessId,
      json: false,
    },
  );
  const launchWizard = parseLaunchWizard(j.launchWizard);
  return {
    score: typeof j.score === "number" ? j.score : 0,
    maxScore: typeof j.maxScore === "number" ? j.maxScore : 0,
    checklist: Array.isArray(j.checklist) ? j.checklist : [],
    recommendations: Array.isArray(j.recommendations) ? j.recommendations : [],
    ...(launchWizard != null ? { launchWizard } : {}),
  };
}

export async function postPlatformFeedback(input: {
  kind: "bug" | "feature" | "ux" | "other";
  message: string;
  businessId?: number;
  page?: string;
}): Promise<void> {
  await adminFetchVoid(apiAbsoluteUrl("/api/platform/feedback"), {
    method: "POST",
    businessId: input.businessId,
    body: JSON.stringify(input),
  });
}
