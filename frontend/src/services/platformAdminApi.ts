import { apiAbsoluteUrl } from "./api";
import { formatHttpStatusError } from "../utils/adminApiError";
import { telegramWebAppInitDataHeader } from "../utils/telegramInitDataHeader";

export type PlatformAdminRequestDTO = {
  id: number;
  storeName: string;
  phone: string;
  status: string;
  createdAt: string;
  telegramId: string;
  ownerUsername: string | null;
  businessType: string;
  botUsername: string | null;
  finikHasApiKey: boolean;
  finikHasAccountId: boolean;
  finikRegistrationComplete: boolean;
  finikAdminLine: string;
};

export type PlatformAdminBusinessDTO = {
  id: number;
  name: string;
  isActive: boolean;
  isBlocked: boolean;
  status: string;
  subscriptionActive: boolean;
  subscriptionStatus: string;
  subscriptionEndsAt: string | null;
  trialEndsAt: string | null;
  webhookStatus: "OK" | "ERROR";
  webhookUrl: string | null;
  finikReady: boolean;
  finikHasApiKey: boolean;
  finikHasAccountId: boolean;
};

type AdminCallOptions = {
  operatorSessionToken?: string;
};

function adminHeaders(
  _telegramId: number,
  options?: AdminCallOptions,
): HeadersInit {
  void _telegramId;
  const base = telegramWebAppInitDataHeader();
  const token = options?.operatorSessionToken?.trim();
  if (token) {
    return {
      ...base,
      "x-operator-session": token,
    };
  }
  return base;
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };
  if (res.status === 403) {
    const err = new Error(j.error ?? "Нет доступа") as Error & {
      status: number;
      code?: string;
    };
    err.code = j.code;
    err.status = 403;
    throw err;
  }
  throw new Error(formatHttpStatusError(res.status, j.error ?? ""));
}

export async function fetchPlatformAdminRequests(
  telegramId: number,
  options?: AdminCallOptions,
): Promise<PlatformAdminRequestDTO[]> {
  const tid = encodeURIComponent(String(telegramId));
  const res = await fetch(
    apiAbsoluteUrl(`/api/platform/admin/requests?telegramId=${tid}`),
    {
      method: "GET",
      credentials: "omit",
      headers: adminHeaders(telegramId, options),
    },
  );
  await throwIfNotOk(res);
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? data : [];
}

export async function postPlatformAdminApprove(params: {
  telegramId: number;
  requestId: number;
  operatorSessionToken?: string;
}): Promise<{ businessId: number }> {
  const res = await fetch(apiAbsoluteUrl("/api/platform/admin/approve"), {
    method: "POST",
    credentials: "omit",
    headers: {
      ...adminHeaders(params.telegramId, params),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requestId: params.requestId }),
  });
  await throwIfNotOk(res);
  const data = (await res.json()) as { businessId?: number };
  if (typeof data.businessId !== "number") {
    throw new Error("Некорректный ответ сервера");
  }
  return { businessId: data.businessId };
}

export async function postPlatformAdminReject(params: {
  telegramId: number;
  requestId: number;
  rejectReason?: string;
  operatorSessionToken?: string;
}): Promise<void> {
  const res = await fetch(apiAbsoluteUrl("/api/platform/admin/reject"), {
    method: "POST",
    credentials: "omit",
    headers: {
      ...adminHeaders(params.telegramId, params),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requestId: params.requestId,
      rejectReason: params.rejectReason,
    }),
  });
  await throwIfNotOk(res);
}

export async function fetchPlatformAdminBusinesses(params: {
  telegramId: number;
  search?: string;
  operatorSessionToken?: string;
}): Promise<PlatformAdminBusinessDTO[]> {
  const tid = encodeURIComponent(String(params.telegramId));
  const q =
    params.search != null && params.search.trim() !== ""
      ? `&search=${encodeURIComponent(params.search.trim().slice(0, 128))}`
      : "";
  const res = await fetch(
    apiAbsoluteUrl(`/api/platform/admin/businesses?telegramId=${tid}${q}`),
    {
      method: "GET",
      credentials: "omit",
      headers: adminHeaders(params.telegramId, params),
    },
  );
  await throwIfNotOk(res);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return (data as Record<string, unknown>[]).map((row) => ({
    id: typeof row.id === "number" ? row.id : Number(row.id) || 0,
    name: String(row.name ?? ""),
    isActive: Boolean(row.isActive),
    isBlocked: Boolean(row.isBlocked),
    status: String(row.status ?? ""),
    subscriptionActive:
      typeof row.subscriptionActive === "boolean"
        ? row.subscriptionActive
        : Boolean(row.isActive) && !row.isBlocked,
    subscriptionStatus: String(row.subscriptionStatus ?? ""),
    subscriptionEndsAt:
      typeof row.subscriptionEndsAt === "string" ? row.subscriptionEndsAt : null,
    trialEndsAt: typeof row.trialEndsAt === "string" ? row.trialEndsAt : null,
    webhookStatus: row.webhookStatus === "OK" ? "OK" : "ERROR",
    webhookUrl:
      typeof row.webhookUrl === "string" && row.webhookUrl.trim() !== ""
        ? row.webhookUrl.trim()
        : null,
    finikReady: Boolean(row.finikReady),
    finikHasApiKey: Boolean(row.finikHasApiKey),
    finikHasAccountId: Boolean(row.finikHasAccountId),
  })) as PlatformAdminBusinessDTO[];
}

export async function postPlatformAdminDisable(params: {
  telegramId: number;
  businessId: number;
  operatorSessionToken?: string;
}): Promise<void> {
  const res = await fetch(apiAbsoluteUrl("/api/platform/admin/disable"), {
    method: "POST",
    credentials: "omit",
    headers: {
      ...adminHeaders(params.telegramId, params),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ businessId: params.businessId }),
  });
  await throwIfNotOk(res);
}

export async function postPlatformAdminEnable(params: {
  telegramId: number;
  businessId: number;
  operatorSessionToken?: string;
}): Promise<void> {
  const res = await fetch(apiAbsoluteUrl("/api/platform/admin/enable"), {
    method: "POST",
    credentials: "omit",
    headers: {
      ...adminHeaders(params.telegramId, params),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ businessId: params.businessId }),
  });
  await throwIfNotOk(res);
}

export async function postPlatformAdminUnblock(params: {
  telegramId: number;
  businessId: number;
  operatorSessionToken?: string;
}): Promise<void> {
  const res = await fetch(apiAbsoluteUrl("/api/platform/admin/unblock"), {
    method: "POST",
    credentials: "omit",
    headers: {
      ...adminHeaders(params.telegramId, params),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ businessId: params.businessId }),
  });
  await throwIfNotOk(res);
}

/** Переподключение вебхука и инстанса бота на сервере (магазин активен и не в блокировке). */
export async function postPlatformAdminRestartDynamicBot(params: {
  telegramId: number;
  businessId: number;
  operatorSessionToken?: string;
}): Promise<void> {
  const res = await fetch(
    apiAbsoluteUrl("/api/platform/admin/restart-dynamic-bot"),
    {
      method: "POST",
      credentials: "omit",
      headers: {
        ...adminHeaders(params.telegramId, params),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ businessId: params.businessId }),
    },
  );
  await throwIfNotOk(res);
}

export async function postPlatformAdminPurgeBusiness(params: {
  telegramId: number;
  businessId: number;
  operatorSessionToken?: string;
}): Promise<void> {
  const res = await fetch(apiAbsoluteUrl("/api/platform/admin/purge-business"), {
    method: "POST",
    credentials: "omit",
    headers: {
      ...adminHeaders(params.telegramId, params),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ businessId: params.businessId }),
  });
  await throwIfNotOk(res);
}

export async function postPlatformAdminExtend(params: {
  telegramId: number;
  businessId: number;
  days: 30 | 90;
  operatorSessionToken?: string;
}): Promise<{ subscriptionEndsAt: string }> {
  const res = await fetch(apiAbsoluteUrl("/api/platform/admin/extend"), {
    method: "POST",
    credentials: "omit",
    headers: {
      ...adminHeaders(params.telegramId, params),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      businessId: params.businessId,
      days: params.days,
    }),
  });
  await throwIfNotOk(res);
  const data = (await res.json()) as { subscriptionEndsAt?: string };
  if (typeof data.subscriptionEndsAt !== "string") {
    throw new Error("Некорректный ответ сервера");
  }
  return { subscriptionEndsAt: data.subscriptionEndsAt };
}
