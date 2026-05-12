import { apiAbsoluteUrl } from "./api";
import { telegramWebAppInitDataHeader } from "../utils/telegramInitDataHeader";

export type PlatformMyBusinessDTO = {
  id: number;
  name: string;
  /** Серверное значение статуса (blocked, active, …) */
  status: string;
  isActive: boolean;
  isBlocked: boolean;
  subscriptionActive: boolean;
  webhookStatus: "OK" | "ERROR";
  /** URL вебхука из Telegram (без токена бота). */
  webhookUrl: string | null;
};

export async function fetchPlatformMyBusinesses(params: {
  telegramId: number;
}): Promise<PlatformMyBusinessDTO[]> {
  void params.telegramId;
  const res = await fetch(apiAbsoluteUrl("/api/platform/my-businesses"), {
    method: "GET",
    credentials: "omit",
    headers: { ...telegramWebAppInitDataHeader() },
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
  const data = (await res.json()) as unknown;
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
    return {
      id:
        typeof idNum === "number" &&
        Number.isInteger(idNum) &&
        idNum > 0
          ? idNum
          : 0,
      name: String(x.name ?? ""),
      status: String(x.status ?? ""),
      isActive,
      isBlocked,
      subscriptionActive:
        typeof x.subscriptionActive === "boolean"
          ? x.subscriptionActive
          : isActive && !isBlocked,
      webhookStatus: ws,
      webhookUrl: wu,
    };
  });
  return mapped.filter((r) => r.id > 0);
}

export type PlatformStoreSettingsDTO = {
  businessId: number;
  name: string;
  finikConfigured: boolean;
  pendingBotTokenChange: boolean;
  businessType: string;
  merchantConfig: Record<string, unknown>;
  merchantSettingsSchema: Record<string, unknown>;
};

export async function fetchPlatformStoreSettings(params: {
  telegramId: number;
  businessId: number;
}): Promise<PlatformStoreSettingsDTO> {
  void params.telegramId;
  const q = new URLSearchParams({
    businessId: String(params.businessId),
  });
  const res = await fetch(
    apiAbsoluteUrl(`/api/platform/store-settings?${q.toString()}`),
    {
      method: "GET",
      credentials: "omit",
      headers: { ...telegramWebAppInitDataHeader() },
    },
  );
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    businessId?: number;
    name?: string;
    finikConfigured?: boolean;
    pendingBotTokenChange?: boolean;
    businessType?: unknown;
    merchantConfig?: unknown;
    merchantSettingsSchema?: unknown;
  };
  if (!res.ok) {
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
  const bid =
    typeof j.businessId === "number" && Number.isInteger(j.businessId)
      ? j.businessId
      : 0;
  if (bid <= 0) {
    throw new Error("Некорректный ответ сервера");
  }
  return {
    businessId: bid,
    name: String(j.name ?? ""),
    finikConfigured: Boolean(j.finikConfigured),
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
  };
}

export type PlatformStoreSettingsSaveResult = {
  ok: true;
  name: string;
  finikConfigured: boolean;
  pendingBotTokenChange: boolean;
  botTokenChangeRequestId?: number;
};

export async function savePlatformStoreSettings(payload: {
  telegramId: number;
  businessId: number;
  storeName?: string;
  newBotToken?: string;
  merchantConfig?: Record<string, unknown>;
}): Promise<PlatformStoreSettingsSaveResult> {
  void payload.telegramId;
  const body: Record<string, unknown> = {
    businessId: payload.businessId,
  };
  if (payload.storeName !== undefined) body.storeName = payload.storeName;
  if (payload.newBotToken !== undefined) body.newBotToken = payload.newBotToken;
  if (payload.merchantConfig !== undefined)
    body.merchantConfig = payload.merchantConfig;

  const res = await fetch(apiAbsoluteUrl("/api/platform/store-settings"), {
    method: "POST",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      ...telegramWebAppInitDataHeader(),
    },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    ok?: boolean;
    name?: string;
    finikConfigured?: boolean;
    pendingBotTokenChange?: boolean;
    botTokenChangeRequestId?: number;
  };
  if (!res.ok) {
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
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
  };
}

export async function postPlatformUpdateFinik(payload: {
  telegramId: number;
  businessId: number;
  finikApiKey: string;
}): Promise<{ ok: true; finikConfigured: boolean }> {
  void payload.telegramId;
  const res = await fetch(apiAbsoluteUrl("/api/platform/update-finik"), {
    method: "POST",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      ...telegramWebAppInitDataHeader(),
    },
    body: JSON.stringify({
      businessId: payload.businessId,
      finikApiKey: payload.finikApiKey,
    }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    ok?: boolean;
    finikConfigured?: boolean;
  };
  if (!res.ok) {
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
  if (j.ok !== true) {
    throw new Error(j.error ?? "Некорректный ответ сервера");
  }
  return { ok: true, finikConfigured: Boolean(j.finikConfigured) };
}

export async function submitPlatformRegisterRequest(payload: {
  storeName: string;
  botToken: string;
  phone: string;
  telegramId: number;
}): Promise<void> {
  void payload.telegramId;
  const res = await fetch(apiAbsoluteUrl("/api/platform/register-request"), {
    method: "POST",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      ...telegramWebAppInitDataHeader(),
    },
    body: JSON.stringify({
      storeName: payload.storeName,
      botToken: payload.botToken,
      phone: payload.phone,
      telegramId: payload.telegramId,
    }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
}

export async function postPlatformCheckWebhook(params: {
  telegramId: number;
  businessId: number;
}): Promise<{ status: "OK" | "ERROR"; lastErrorMessage: string | null }> {
  void params.telegramId;
  const res = await fetch(apiAbsoluteUrl("/api/platform/check-webhook"), {
    method: "POST",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      ...telegramWebAppInitDataHeader(),
    },
    body: JSON.stringify({ businessId: params.businessId }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    status?: string;
    lastErrorMessage?: string | null;
  };
  if (!res.ok) {
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
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
  const res = await fetch(apiAbsoluteUrl("/api/platform/toggle-bot"), {
    method: "POST",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      ...telegramWebAppInitDataHeader(),
    },
    body: JSON.stringify({
      businessId: params.businessId,
      action: params.action,
    }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    ok?: boolean;
    isActive?: boolean;
  };
  if (!res.ok) {
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
  if (
    typeof j.ok !== "boolean" ||
    typeof j.isActive !== "boolean"
  ) {
    throw new Error("Некорректный ответ сервера");
  }
  return { ok: j.ok, isActive: j.isActive };
}
