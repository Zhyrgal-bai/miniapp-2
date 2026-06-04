/**
 * Адрес магазина (Business) — Phase 1 foundation для доставки и карт.
 */

export type BusinessAddressInput = {
  addressLine?: unknown;
  city?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

export type ParsedBusinessAddress = {
  addressLine: string;
  city: string;
  latitude: number;
  longitude: number;
};

export type BusinessAddressPublic = {
  addressLine: string;
  city: string;
  latitude: number;
  longitude: number;
};

const ADDRESS_LINE_MAX = 500;
const CITY_MAX = 120;

/** Примерные границы КР для валидации координат (расширяемо). */
const KG_LAT_MIN = 39.0;
const KG_LAT_MAX = 43.5;
const KG_LNG_MIN = 69.0;
const KG_LNG_MAX = 80.5;

export const KG_SUGGESTED_CITIES = [
  "Бишкек",
  "Ош",
  "Джалал-Абад",
  "Каракол",
  "Токмок",
  "Нарын",
  "Баткен",
  "Талас",
  "Кант",
  "Кара-Балта",
] as const;

function cleanLine(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim();
}

function parseCoord(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const t = raw.trim().replace(",", ".");
    if (t === "") return null;
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function isLatitudeInKgRange(lat: number): boolean {
  return lat >= KG_LAT_MIN && lat <= KG_LAT_MAX;
}

export function isLongitudeInKgRange(lng: number): boolean {
  return lng >= KG_LNG_MIN && lng <= KG_LNG_MAX;
}

export function parseBusinessAddressInput(
  input: BusinessAddressInput,
): { ok: true; value: ParsedBusinessAddress } | { ok: false; error: string } {
  const addressLine = cleanLine(input.addressLine);
  const city = cleanLine(input.city);

  if (addressLine.length < 3) {
    return { ok: false, error: "Укажите адрес магазина (не менее 3 символов)" };
  }
  if (addressLine.length > ADDRESS_LINE_MAX) {
    return {
      ok: false,
      error: `Адрес: не более ${ADDRESS_LINE_MAX} символов`,
    };
  }
  if (city.length < 2) {
    return { ok: false, error: "Укажите город" };
  }
  if (city.length > CITY_MAX) {
    return { ok: false, error: `Город: не более ${CITY_MAX} символов` };
  }

  const latitude = parseCoord(input.latitude);
  const longitude = parseCoord(input.longitude);
  if (latitude == null || longitude == null) {
    return { ok: false, error: "Укажите координаты (широта и долгота)" };
  }
  if (!isLatitudeInKgRange(latitude)) {
    return {
      ok: false,
      error: `Широта вне диапазона для КР (${KG_LAT_MIN}…${KG_LAT_MAX})`,
    };
  }
  if (!isLongitudeInKgRange(longitude)) {
    return {
      ok: false,
      error: `Долгота вне диапазона для КР (${KG_LNG_MIN}…${KG_LNG_MAX})`,
    };
  }

  return {
    ok: true,
    value: {
      addressLine,
      city,
      latitude: Math.round(latitude * 1_000_000) / 1_000_000,
      longitude: Math.round(longitude * 1_000_000) / 1_000_000,
    },
  };
}

export function businessAddressRowToPublic(row: {
  addressLine: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}): BusinessAddressPublic | null {
  const addressLine = cleanLine(row.addressLine);
  const city = cleanLine(row.city);
  if (addressLine === "" && city === "") return null;
  const lat = row.latitude;
  const lng = row.longitude;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return {
    addressLine,
    city,
    latitude: lat,
    longitude: lng,
  };
}

export function prismaBusinessAddressData(
  parsed: ParsedBusinessAddress,
): ParsedBusinessAddress {
  return parsed;
}
