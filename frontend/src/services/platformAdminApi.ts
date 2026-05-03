import { apiAbsoluteUrl } from "./api";

export type PlatformAdminRequestDTO = {
  id: number;
  storeName: string;
  phone: string;
  status: string;
  createdAt: string;
};

function adminHeaders(telegramId: number): HeadersInit {
  return { "x-telegram-id": String(telegramId) };
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
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
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
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
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
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
}
