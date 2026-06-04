import {
  isLatitudeInKgRange,
  isLongitudeInKgRange,
  parseBusinessAddressInput,
  type ParsedBusinessAddress,
} from "@repo-shared/businessAddress";

export type MerchantStoreAddressDraft = {
  addressLine: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
};

export type ResolvedMerchantAddress = {
  city: string;
  addressLine: string;
  latitude: number;
  longitude: number;
  displayAddress: string;
};

function roundCoord(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

export function formatMerchantStoreAddressDisplay(
  city: string,
  addressLine: string,
): string {
  const c = city.trim();
  const l = addressLine.trim();
  if (c !== "" && l !== "") return `${c}, ${l}`;
  return c || l;
}

/** Разбор однострочного поля «Город, улица». */
export function parseDisplayAddressInput(text: string): {
  city: string;
  addressLine: string;
} {
  const t = text.replace(/\s+/g, " ").trim();
  const comma = t.indexOf(",");
  if (comma > 0) {
    return {
      city: t.slice(0, comma).trim(),
      addressLine: t.slice(comma + 1).trim(),
    };
  }
  return { city: "", addressLine: t };
}

function cityFromNominatimAddress(
  addr: Record<string, string | undefined>,
): string {
  const raw =
    addr.city ??
    addr.town ??
    addr.village ??
    addr.municipality ??
    addr.county ??
    addr.state ??
    "";
  const c = String(raw).trim();
  return c !== "" ? c : "Бишкек";
}

function addressLineFromNominatim(
  addr: Record<string, string | undefined>,
  displayName: string,
): string {
  const parts = [addr.road, addr.house_number].filter(
    (p) => typeof p === "string" && p.trim() !== "",
  ) as string[];
  if (parts.length > 0) {
    return parts.join(" ").trim().slice(0, 500);
  }
  const segments = displayName
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length >= 2) {
    return segments.slice(0, 2).join(", ").slice(0, 500);
  }
  return displayName.trim().slice(0, 500);
}

function resolvedFromNominatimHit(
  hit: Record<string, unknown>,
): ResolvedMerchantAddress | null {
  const lat = Number(hit.lat);
  const lng = Number(hit.lon ?? hit.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!isLatitudeInKgRange(lat) || !isLongitudeInKgRange(lng)) return null;

  const displayName =
    typeof hit.display_name === "string" ? hit.display_name.trim() : "";
  const addrRaw = hit.address;
  const addr =
    addrRaw != null && typeof addrRaw === "object" && !Array.isArray(addrRaw)
      ? (addrRaw as Record<string, string | undefined>)
      : {};

  const city = cityFromNominatimAddress(addr);
  const addressLine =
    displayName !== ""
      ? addressLineFromNominatim(addr, displayName)
      : city;

  return {
    city,
    addressLine,
    latitude: roundCoord(lat),
    longitude: roundCoord(lng),
    displayAddress: formatMerchantStoreAddressDisplay(city, addressLine),
  };
}

export async function reverseGeocodeKg(
  latitude: number,
  longitude: number,
): Promise<
  { ok: true; value: ResolvedMerchantAddress } | { ok: false; error: string }
> {
  if (!isLatitudeInKgRange(latitude) || !isLongitudeInKgRange(longitude)) {
    return {
      ok: false,
      error: "Местоположение должно быть в пределах Кыргызстана.",
    };
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("accept-language", "ru");

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const resolved = resolvedFromNominatimHit(data);
    if (resolved == null) {
      return {
        ok: false,
        error: "Не удалось определить адрес по координатам.",
      };
    }
    return { ok: true, value: resolved };
  } catch {
    return {
      ok: false,
      error: "Не удалось определить адрес. Проверьте интернет и попробуйте снова.",
    };
  }
}

export async function geocodeAddressQuery(
  query: string,
): Promise<
  { ok: true; value: ResolvedMerchantAddress } | { ok: false; error: string }
> {
  const q = query.replace(/\s+/g, " ").trim();
  if (q.length < 3) {
    return { ok: false, error: "Укажите адрес магазина" };
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", q.includes("Кыргызстан") ? q : `${q}, Кыргызстан`);
  url.searchParams.set("accept-language", "ru");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "kg");

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    const raw = (await res.json().catch(() => [])) as unknown;
    const rows = Array.isArray(raw) ? raw : [];
    const hit = rows[0];
    if (hit == null || typeof hit !== "object") {
      return {
        ok: false,
        error: "Не удалось найти адрес. Уточните формулировку или выберите на карте.",
      };
    }
    const resolved = resolvedFromNominatimHit(hit as Record<string, unknown>);
    if (resolved == null) {
      return {
        ok: false,
        error: "Адрес должен быть в пределах Кыргызстана.",
      };
    }
    return { ok: true, value: resolved };
  } catch {
    return {
      ok: false,
      error: "Не удалось определить адрес. Проверьте интернет и попробуйте снова.",
    };
  }
}

/** @deprecated Используйте geocodeAddressQuery или resolveMerchantStoreAddressForSave */
export async function geocodeBusinessAddress(
  city: string,
  addressLine: string,
): Promise<
  { ok: true; latitude: number; longitude: number } | { ok: false; error: string }
> {
  const q = formatMerchantStoreAddressDisplay(city, addressLine);
  const r = await geocodeAddressQuery(q);
  if (!r.ok) return r;
  return {
    ok: true,
    latitude: r.value.latitude,
    longitude: r.value.longitude,
  };
}

export async function resolveMerchantStoreAddressForSave(
  draft: MerchantStoreAddressDraft,
): Promise<
  { ok: true; value: ParsedBusinessAddress } | { ok: false; error: string }
> {
  const display = formatMerchantStoreAddressDisplay(
    draft.city,
    draft.addressLine,
  );
  if (display.length < 5) {
    return { ok: false, error: "Укажите адрес магазина (не менее 5 символов)" };
  }

  if (
    draft.latitude != null &&
    draft.longitude != null &&
    draft.city.trim().length >= 2 &&
    draft.addressLine.trim().length >= 3
  ) {
    const direct = parseBusinessAddressInput({
      addressLine: draft.addressLine,
      city: draft.city,
      latitude: draft.latitude,
      longitude: draft.longitude,
    });
    if (direct.ok) return direct;
  }

  const parsed = parseDisplayAddressInput(display);
  const query =
    parsed.city !== ""
      ? formatMerchantStoreAddressDisplay(parsed.city, parsed.addressLine)
      : display;

  const geo = await geocodeAddressQuery(query);
  if (!geo.ok) return geo;

  return parseBusinessAddressInput({
    addressLine: geo.value.addressLine,
    city: geo.value.city,
    latitude: geo.value.latitude,
    longitude: geo.value.longitude,
  });
}

export function draftFromStoreAddressPublic(row: {
  addressLine: string;
  city: string;
  latitude: number;
  longitude: number;
}): MerchantStoreAddressDraft {
  return {
    addressLine: row.addressLine,
    city: row.city,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

export function emptyMerchantStoreAddressDraft(
  defaultCity = "Бишкек",
): MerchantStoreAddressDraft {
  return {
    addressLine: "",
    city: defaultCity,
    latitude: null,
    longitude: null,
  };
}

export function validateMerchantAddressDisplay(
  draft: MerchantStoreAddressDraft,
): string | null {
  const display = formatMerchantStoreAddressDisplay(
    draft.city,
    draft.addressLine,
  );
  if (display.length < 5) {
    return "Укажите адрес магазина";
  }
  if (display.length > 620) {
    return "Адрес слишком длинный";
  }
  return null;
}
