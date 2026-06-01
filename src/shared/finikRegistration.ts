import {
  isValidFinikAccountId,
  isValidFinikApiKey,
} from "../bot/saasRegistrationValidation.js";

export function isFinikSkipInput(raw: string): boolean {
  const t = raw.trim();
  if (t === "-") return true;
  const low = t.toLowerCase();
  return low === "skip" || low === "нет";
}

export type ParsedFinikRegistration =
  | { ok: true; skip: true }
  | { ok: true; skip: false; finikApiKey: string; finikAccountId: string }
  | { ok: false; error: string };

/** Нормализация пары Finik для заявки / provision (skip = оба пустые). */
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
  return { ok: true, skip: false, finikApiKey: key, finikAccountId: account };
}

export function finikRegistrationAdminLine(input: {
  finikApiKey?: string | null;
  finikAccountId?: string | null;
}): string {
  const parsed = parseFinikRegistrationFields(input);
  if (parsed.ok && parsed.skip) return "не подключён";
  if (!parsed.ok) return "ошибка данных";
  return "API Key + Account ID";
}

export function finikRegistrationComplete(input: {
  finikApiKey?: string | null;
  finikAccountId?: string | null;
}): boolean {
  const parsed = parseFinikRegistrationFields(input);
  return parsed.ok && !parsed.skip;
}
