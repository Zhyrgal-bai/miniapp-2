/**
 * Локальное хранение координат покупателя (Phase 3 foundation).
 * localStorage — переживает закрытие браузера; ключ per-tenant.
 */

export type CustomerLocationConsent = "unknown" | "granted" | "denied";

export type CustomerLocationRecord = {
  version: 1;
  businessId: number;
  consent: CustomerLocationConsent;
  latitude: number | null;
  longitude: number | null;
  updatedAt: number;
  /** Точность GPS в метрах, если известна. */
  accuracyM: number | null;
};

const STORAGE_PREFIX = "sf:customerLocation:v1:";

function storageKey(businessId: number): string {
  return `${STORAGE_PREFIX}${Math.trunc(businessId)}`;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
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
  };
}

export function loadCustomerLocation(businessId: number): CustomerLocationRecord {
  const bid = Math.trunc(Number(businessId));
  if (!Number.isFinite(bid) || bid <= 0) return emptyRecord(0);

  try {
    const raw = localStorage.getItem(storageKey(bid));
    if (raw == null || raw.trim() === "") return emptyRecord(bid);
    const j = JSON.parse(raw) as unknown;
    if (!isObj(j) || j.version !== 1) return emptyRecord(bid);
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
    };
  } catch {
    return emptyRecord(bid);
  }
}

export function saveCustomerLocation(record: CustomerLocationRecord): void {
  const bid = Math.trunc(Number(record.businessId));
  if (!Number.isFinite(bid) || bid <= 0) return;
  try {
    localStorage.setItem(
      storageKey(bid),
      JSON.stringify({
        version: 1,
        businessId: bid,
        consent: record.consent,
        latitude: record.latitude,
        longitude: record.longitude,
        updatedAt: record.updatedAt,
        accuracyM: record.accuracyM,
      }),
    );
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
  coords: { latitude: number; longitude: number; accuracyM?: number | null },
): CustomerLocationRecord {
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
