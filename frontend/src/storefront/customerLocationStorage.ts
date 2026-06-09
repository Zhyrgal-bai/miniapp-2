/**
 * Локальное хранение координат и адреса покупателя.
 * localStorage — per-tenant; опционально Telegram CloudStorage.
 */

export type CustomerLocationConsent = "unknown" | "granted" | "denied";

export type CustomerLocationAddress = {
  formattedAddress: string | null;
  city: string | null;
  country: string | null;
  street: string | null;
  houseNumber: string | null;
};

export type CustomerLocationRecord = {
  version: 1;
  businessId: number;
  consent: CustomerLocationConsent;
  latitude: number | null;
  longitude: number | null;
  updatedAt: number;
  accuracyM: number | null;
  formattedAddress: string | null;
  city: string | null;
  country: string | null;
  street: string | null;
  houseNumber: string | null;
};

const STORAGE_PREFIX = "sf:customerLocation:v1:";
const TG_CLOUD_PREFIX = "sf:customerLocation:v1:";

function storageKey(businessId: number): string {
  return `${STORAGE_PREFIX}${Math.trunc(businessId)}`;
}

function tgCloudKey(businessId: number): string {
  return `${TG_CLOUD_PREFIX}${Math.trunc(businessId)}`;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function readStr(o: Record<string, unknown>, key: string): string | null {
  const v = o[key];
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t !== "" ? t : null;
}

function emptyRecord(businessId: number): CustomerLocationRecord {
  return {
    version: 1,
    businessId: Math.trunc(businessId),
    consent: "unknown",
    latitude: null,
    longitude: null,
    updatedAt: 0,
    accuracyM: null,
    formattedAddress: null,
    city: null,
    country: null,
    street: null,
    houseNumber: null,
  };
}

function parseRecord(bid: number, j: Record<string, unknown>): CustomerLocationRecord {
  const consent =
    j.consent === "granted" || j.consent === "denied" ? j.consent : "unknown";
  const lat = typeof j.latitude === "number" && Number.isFinite(j.latitude) ? j.latitude : null;
  const lng =
    typeof j.longitude === "number" && Number.isFinite(j.longitude) ? j.longitude : null;
  const updatedAt =
    typeof j.updatedAt === "number" && Number.isFinite(j.updatedAt) ? j.updatedAt : 0;
  const accuracyM =
    typeof j.accuracyM === "number" && Number.isFinite(j.accuracyM) ? j.accuracyM : null;
  return {
    version: 1,
    businessId: bid,
    consent,
    latitude: lat,
    longitude: lng,
    updatedAt,
    accuracyM,
    formattedAddress: readStr(j, "formattedAddress"),
    city: readStr(j, "city"),
    country: readStr(j, "country"),
    street: readStr(j, "street"),
    houseNumber: readStr(j, "houseNumber"),
  };
}

function serializeRecord(record: CustomerLocationRecord): string {
  return JSON.stringify({
    version: 1,
    businessId: record.businessId,
    consent: record.consent,
    latitude: record.latitude,
    longitude: record.longitude,
    updatedAt: record.updatedAt,
    accuracyM: record.accuracyM,
    formattedAddress: record.formattedAddress,
    city: record.city,
    country: record.country,
    street: record.street,
    houseNumber: record.houseNumber,
  });
}

function telegramCloudStorage():
  | {
      getItem: (
        key: string,
        cb: (error: string | null, value?: string) => void,
      ) => void;
      setItem: (
        key: string,
        value: string,
        cb: (error: string | null, stored?: boolean) => void,
      ) => void;
    }
  | undefined {
  if (typeof window === "undefined") return undefined;
  const tg = window.Telegram?.WebApp as
    | (TelegramWebApp & {
        CloudStorage?: {
          getItem: (
            key: string,
            cb: (error: string | null, value?: string) => void,
          ) => void;
          setItem: (
            key: string,
            value: string,
            cb: (error: string | null, stored?: boolean) => void,
          ) => void;
        };
      })
    | undefined;
  return tg?.CloudStorage;
}

/** Async merge from Telegram CloudStorage when localStorage is empty. */
export function hydrateCustomerLocationFromTelegramCloud(
  businessId: number,
): Promise<CustomerLocationRecord | null> {
  const bid = Math.trunc(Number(businessId));
  if (!Number.isFinite(bid) || bid <= 0) return Promise.resolve(null);
  if (typeof window === "undefined") return Promise.resolve(null);
  const cs = telegramCloudStorage();
  if (cs == null) return Promise.resolve(null);

  const local = loadCustomerLocation(bid);
  if (hasCustomerLocationConsentDecision(bid)) return Promise.resolve(local);

  return new Promise((resolve) => {
    cs.getItem(tgCloudKey(bid), (err: string | null, value?: string) => {
      if (err || typeof value !== "string" || value.trim() === "") {
        resolve(null);
        return;
      }
      try {
        const j = JSON.parse(value) as unknown;
        if (j == null || typeof j !== "object" || Array.isArray(j)) {
          resolve(null);
          return;
        }
        const parsed = parseRecord(bid, j as Record<string, unknown>);
        saveCustomerLocation(parsed);
        resolve(parsed);
      } catch {
        resolve(null);
      }
    });
  });
}

function writeTelegramCloudStorage(key: string, value: string): void {
  const cs = telegramCloudStorage();
  cs?.setItem(key, value, () => {});
}

export function loadCustomerLocation(businessId: number): CustomerLocationRecord {
  const bid = Math.trunc(Number(businessId));
  if (!Number.isFinite(bid) || bid <= 0) return emptyRecord(0);

  try {
    const raw = localStorage.getItem(storageKey(bid));
    if (raw == null || raw.trim() === "") return emptyRecord(bid);
    const j = JSON.parse(raw) as unknown;
    if (!isObj(j) || j.version !== 1) return emptyRecord(bid);
    return parseRecord(bid, j);
  } catch {
    return emptyRecord(bid);
  }
}

export function saveCustomerLocation(record: CustomerLocationRecord): void {
  const bid = Math.trunc(Number(record.businessId));
  if (!Number.isFinite(bid) || bid <= 0) return;
  const payload = serializeRecord(record);
  try {
    localStorage.setItem(storageKey(bid), payload);
    writeTelegramCloudStorage(tgCloudKey(bid), payload);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("sf:customerLocationChanged", { detail: { businessId: bid } }),
      );
    }
  } catch {
    /* quota / private mode */
  }
}

export function markCustomerLocationDenied(businessId: number): CustomerLocationRecord {
  const next: CustomerLocationRecord = {
    ...emptyRecord(businessId),
    consent: "denied",
    updatedAt: Date.now(),
  };
  saveCustomerLocation(next);
  return next;
}

export function markCustomerLocationGranted(
  businessId: number,
  coords: {
    latitude: number;
    longitude: number;
    accuracyM?: number | null;
    address?: Partial<CustomerLocationAddress> | null;
  },
): CustomerLocationRecord {
  const addr = coords.address ?? {};
  const next: CustomerLocationRecord = {
    version: 1,
    businessId: Math.trunc(businessId),
    consent: "granted",
    latitude: coords.latitude,
    longitude: coords.longitude,
    updatedAt: Date.now(),
    accuracyM:
      coords.accuracyM != null && Number.isFinite(coords.accuracyM)
        ? coords.accuracyM
        : null,
    formattedAddress: addr.formattedAddress ?? null,
    city: addr.city ?? null,
    country: addr.country ?? null,
    street: addr.street ?? null,
    houseNumber: addr.houseNumber ?? null,
  };
  saveCustomerLocation(next);
  return next;
}

/** Есть ли сохранённый ответ пользователя (разрешил или отказал). */
export function hasCustomerLocationConsentDecision(businessId: number): boolean {
  const r = loadCustomerLocation(businessId);
  return r.consent === "granted" || r.consent === "denied";
}

export function readCustomerLocationCoords(
  businessId: number,
): { latitude: number; longitude: number } | null {
  const r = loadCustomerLocation(businessId);
  if (r.consent !== "granted" || r.latitude == null || r.longitude == null) return null;
  return { latitude: r.latitude, longitude: r.longitude };
}

export function readCustomerLocationAddress(
  businessId: number,
): CustomerLocationRecord | null {
  const r = loadCustomerLocation(businessId);
  if (r.consent !== "granted" || r.latitude == null || r.longitude == null) return null;
  return r;
}
