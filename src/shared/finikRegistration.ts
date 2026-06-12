import {
  isValidFinikAccountId,
  isValidFinikApiKey,
} from "../bot/saasRegistrationValidation.js";
import { isFinikPlatformManagedMerchantsEnabled } from "../server/finik/resolveFinikTenantCredentials.js";

export function isFinikSkipInput(raw: string): boolean {
  const t = raw.trim();
  if (t === "-") return true;
  const low = t.toLowerCase();
  return low === "skip" || low === "нет";
}

export type ParsedFinikRegistration =
  | { ok: true; skip: true }
  | { ok: true; skip: false; finikAccountId: string; finikApiKey?: string }
  | { ok: false; error: string };

/** Нормализация Finik для заявки / provision (skip = пустые поля). */
export function parseFinikRegistrationFields(input: {
  finikApiKey?: string | null;
  finikAccountId?: string | null;
}): ParsedFinikRegistration {
  const key =
    typeof input.finikApiKey === "string" ? input.finikApiKey.trim() : "";
  const account =
    typeof input.finikAccountId === "string" ? input.finikAccountId.trim() : "";

  if (key === "" && account === "") {
    return { ok: true, skip: true };
  }

  if (isFinikPlatformManagedMerchantsEnabled()) {
    if (key !== "" && account === "") {
      return {
        ok: false,
        error: "Укажите Account ID Finik",
      };
    }
    if (account === "") {
      return { ok: true, skip: true };
    }
    if (!isValidFinikAccountId(account)) {
      return { ok: false, error: "Некорректный Account ID Finik" };
    }
    if (key !== "") {
      if (!isValidFinikApiKey(key)) {
        return { ok: false, error: "Некорректный API Key Finik" };
      }
      return { ok: true, skip: false, finikAccountId: account, finikApiKey: key };
    }
    return { ok: true, skip: false, finikAccountId: account };
  }

  if (key === "" && account !== "") {
    return {
      ok: false,
      error: "Укажите API Key Finik вместе с Account ID",
    };
  }
  if (key !== "" && account === "") {
    return {
      ok: false,
      error: "Укажите Account ID Finik (выдан вместе с API Key)",
    };
  }
  if (!isValidFinikApiKey(key)) {
    return { ok: false, error: "Некорректный API Key Finik" };
  }
  if (!isValidFinikAccountId(account)) {
    return { ok: false, error: "Некорректный Account ID Finik" };
  }
  return {
    ok: true,
    skip: false,
    finikAccountId: account,
    finikApiKey: key,
  };
}

export function finikRegistrationAdminLine(input: {
  finikApiKey?: string | null;
  finikAccountId?: string | null;
}): string {
  const parsed = parseFinikRegistrationFields(input);
  if (parsed.ok && parsed.skip) return "не подключён";
  if (!parsed.ok) return "ошибка данных";
  if (isFinikPlatformManagedMerchantsEnabled()) {
    return "Account ID";
  }
  return "API Key + Account ID";
}

export function finikRegistrationComplete(input: {
  finikApiKey?: string | null;
  finikAccountId?: string | null;
}): boolean {
  const parsed = parseFinikRegistrationFields(input);
  return parsed.ok && !parsed.skip;
}
