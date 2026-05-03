import { apiAbsoluteUrl } from "./api";

export type PlatformMyBusinessDTO = {
  id: number;
  name: string;
  isActive: boolean;
};

export async function fetchPlatformMyBusinesses(params: {
  telegramId: number;
}): Promise<PlatformMyBusinessDTO[]> {
  const tid = String(params.telegramId);
  const id = encodeURIComponent(tid);
  const res = await fetch(
    apiAbsoluteUrl(`/api/platform/my-businesses?telegramId=${id}`),
    {
      method: "GET",
      credentials: "omit",
      headers: { "x-telegram-id": tid },
    },
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as PlatformMyBusinessDTO[]) : [];
}

export async function submitPlatformRegisterRequest(payload: {
  storeName: string;
  botToken: string;
  phone: string;
  telegramId: number;
}): Promise<void> {
  const tid = String(payload.telegramId);
  const res = await fetch(apiAbsoluteUrl("/api/platform/register-request"), {
    method: "POST",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      "x-telegram-id": tid,
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
