import { apiAbsoluteUrl } from "./api";

export type PlatformMyBusinessDTO = {
  id: number;
  name: string;
  /** Серверное значение статуса (blocked, active, …) */
  status: string;
  isActive: boolean;
  isBlocked: boolean;
  webhookStatus: "OK" | "ERROR";
};

export async function fetchPlatformMyBusinesses(params: {
  telegramId: number;
}): Promise<PlatformMyBusinessDTO[]> {
  const tid = String(params.telegramId);
  const res = await fetch(apiAbsoluteUrl("/api/platform/my-businesses"), {
    method: "GET",
    credentials: "omit",
    headers: { "x-telegram-id": tid },
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
    return {
      id:
        typeof idNum === "number" &&
        Number.isInteger(idNum) &&
        idNum > 0
          ? idNum
          : 0,
      name: String(x.name ?? ""),
      status: String(x.status ?? ""),
      isActive: Boolean(x.isActive),
      isBlocked: Boolean(x.isBlocked),
      webhookStatus: ws,
    };
  });
  return mapped.filter((r) => r.id > 0);
}

export async function submitPlatformRegisterRequest(payload: {
  storeName: string;
  botToken: string;
  phone: string;
  finikApiKey: string;
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
      finikApiKey: payload.finikApiKey,
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
  const tid = String(params.telegramId);
  const res = await fetch(apiAbsoluteUrl("/api/platform/check-webhook"), {
    method: "POST",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      "x-telegram-id": tid,
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
  const tid = String(params.telegramId);
  const res = await fetch(apiAbsoluteUrl("/api/platform/toggle-bot"), {
    method: "POST",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      "x-telegram-id": tid,
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
