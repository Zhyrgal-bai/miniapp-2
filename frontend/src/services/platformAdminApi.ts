import { apiAbsoluteUrl } from "./api";

export type PlatformAdminRequestDTO = {
  id: number;
  storeName: string;
  phone: string;
  status: string;
  createdAt: string;
};

export type PlatformAdminBusinessDTO = {
  id: number;
  name: string;
  isActive: boolean;
  isBlocked: boolean;
  status: string;
  subscriptionStatus: string;
  subscriptionEndsAt: string | null;
  trialEndsAt: string | null;
  webhookStatus: "OK" | "ERROR";
  webhookUrl: string | null;
};

function adminHeaders(telegramId: number): HeadersInit {
  return { "x-telegram-id": String(telegramId) };
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.status === 403) {
    const err = new Error("Нет доступа");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  if (res.ok) return;
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  throw new Error(j.error ?? `HTTP ${res.status}`);
}

export async function fetchPlatformAdminRequests(
  telegramId: number,
): Promise<PlatformAdminRequestDTO[]> {
  const tid = encodeURIComponent(String(telegramId));
  const res = await fetch(
    apiAbsoluteUrl(`/api/platform/admin/requests?telegramId=${tid}`),
    {
      method: "GET",
      credentials: "omit",
      headers: adminHeaders(telegramId),
    },
  );
  await throwIfNotOk(res);
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? data : [];
}

export async function postPlatformAdminApprove(params: {
  telegramId: number;
  requestId: number;
}): Promise<{ businessId: number }> {
  const res = await fetch(apiAbsoluteUrl("/api/platform/admin/approve"), {
    method: "POST",
    credentials: "omit",
    headers: {
      ...adminHeaders(params.telegramId),
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
}): Promise<void> {
  const res = await fetch(apiAbsoluteUrl("/api/platform/admin/reject"), {
    method: "POST",
    credentials: "omit",
    headers: {
      ...adminHeaders(params.telegramId),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requestId: params.requestId }),
  });
  await throwIfNotOk(res);
}

export async function fetchPlatformAdminBusinesses(params: {
  telegramId: number;
  search?: string;
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
      headers: adminHeaders(params.telegramId),
    },
  );
  await throwIfNotOk(res);
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as PlatformAdminBusinessDTO[]) : [];
}

export async function postPlatformAdminDisable(params: {
  telegramId: number;
  businessId: number;
}): Promise<void> {
  const res = await fetch(apiAbsoluteUrl("/api/platform/admin/disable"), {
    method: "POST",
    credentials: "omit",
    headers: {
      ...adminHeaders(params.telegramId),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ businessId: params.businessId }),
  });
  await throwIfNotOk(res);
}

export async function postPlatformAdminPurgeBusiness(params: {
  telegramId: number;
  businessId: number;
}): Promise<void> {
  const res = await fetch(apiAbsoluteUrl("/api/platform/admin/purge-business"), {
    method: "POST",
    credentials: "omit",
    headers: {
      ...adminHeaders(params.telegramId),
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
}): Promise<{ subscriptionEndsAt: string }> {
  const res = await fetch(apiAbsoluteUrl("/api/platform/admin/extend"), {
    method: "POST",
    credentials: "omit",
    headers: {
      ...adminHeaders(params.telegramId),
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
