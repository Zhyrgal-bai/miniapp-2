import type { MerchantDeliveryRegion } from "./merchantDeliverySettings.js";

/** Structured destination locality from checkout (Phase 9.1). */
export type DeliveryDestinationLocality = {
  city?: string | null;
  district?: string | null;
  region?: string | null;
  country?: string | null;
};

export type MerchantRegionMatchSource =
  | "structured_locality"
  | "city_exact"
  | "destination_label_deprecated"
  | "distance_tier"
  | "single_region"
  | null;

export type MerchantRegionMatchResult = {
  region: MerchantDeliveryRegion | null;
  source: MerchantRegionMatchSource;
};

/** Normalize locality token for exact comparison. */
export function normalizeLocalityPart(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.trim().toLowerCase().replace(/\s+/g, " ");
  return t.length > 0 ? t : null;
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchRegionExact(
  regions: MerchantDeliveryRegion[],
  token: string | null | undefined,
): MerchantDeliveryRegion | null {
  const n = normalizeLocalityPart(token);
  if (!n) return null;
  return regions.find((r) => normalizeLocalityPart(r.name) === n) ?? null;
}

/** Normalized Bishkek city tokens (ru + en). */
export function isBishkekCityName(value: string | null | undefined): boolean {
  const n = normalizeLocalityPart(value);
  if (!n) return false;
  return n === "бишкек" || n === "bishkek";
}

/**
 * @deprecated Substring match on free-text address — Phase 9.1 fallback only.
 */
function matchRegionDeprecatedLabel(
  regions: MerchantDeliveryRegion[],
  destinationLabel: string | null | undefined,
): MerchantDeliveryRegion | null {
  const label = normalizeSearch(destinationLabel ?? "");
  if (!label) return null;

  const exact = regions.find((r) => normalizeLocalityPart(r.name) === label);
  if (exact) return exact;

  return (
    regions.find((r) => {
      const n = normalizeLocalityPart(r.name);
      return n != null && n.length >= 2 && (label.includes(n) || n.includes(label));
    }) ?? null
  );
}

function matchRegionDistanceTiers(
  regions: MerchantDeliveryRegion[],
  distanceKm: number | null | undefined,
): MerchantDeliveryRegion | null {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return null;

  for (const region of regions) {
    const match = /^до\s*([\d.]+)\s*км/i.exec(region.name.trim());
    if (match) {
      const cap = Number(match[1]);
      if (Number.isFinite(cap) && distanceKm <= cap) {
        return region;
      }
    }
  }

  const fallback = regions.find((r) => /дальше|без лимита/i.test(r.name));
  if (fallback) return fallback;
  return regions[regions.length - 1] ?? null;
}

/**
 * Resolve merchant delivery region (Phase 9.1):
 * 1. Structured locality fields (district → region → country, then city in pass 2)
 * 2. Exact normalized city
 * 3. Deprecated destinationLabel substring
 * 4. Distance tier names (legacy migration)
 */
export function resolveMerchantDeliveryRegionWithMeta(
  regions: MerchantDeliveryRegion[],
  input: {
    locality?: DeliveryDestinationLocality | null;
    destinationLabel?: string | null;
    distanceKm?: number | null;
  },
  options?: {
    /** Legacy migrated tier labels (`До N км`). Off for strict REGION_BASED routing. */
    allowDistanceTierMatch?: boolean;
    /** Use sole region when only one configured. Off for strict REGION_BASED routing. */
    allowSingleRegionFallback?: boolean;
  },
): MerchantRegionMatchResult {
  const allowDistanceTierMatch = options?.allowDistanceTierMatch !== false;
  const allowSingleRegionFallback = options?.allowSingleRegionFallback !== false;

  if (regions.length === 0) {
    return { region: null, source: null };
  }

  const locality = input.locality ?? {};

  // Priority 1 — structured locality (exact), city first
  for (const key of ["city", "district", "region", "country"] as const) {
    const match = matchRegionExact(regions, locality[key]);
    if (match) return { region: match, source: "structured_locality" };
  }

  // Priority 2 — exact city from parsed display address when city field missing
  const parsedCity = parseCityFromDisplayAddress(input.destinationLabel);
  const cityOnlyMatch = matchRegionExact(regions, parsedCity);
  if (cityOnlyMatch) return { region: cityOnlyMatch, source: "city_exact" };

  // Priority 3 — deprecated free-text fallback
  const labelMatch = matchRegionDeprecatedLabel(regions, input.destinationLabel);
  if (labelMatch) return { region: labelMatch, source: "destination_label_deprecated" };

  // Priority 4 — distance / migrated tier labels (legacy migration only)
  if (allowDistanceTierMatch) {
    const distanceMatch = matchRegionDistanceTiers(regions, input.distanceKm);
    if (distanceMatch) return { region: distanceMatch, source: "distance_tier" };
  }

  if (allowSingleRegionFallback && regions.length === 1) {
    return { region: regions[0] ?? null, source: "single_region" };
  }

  return { region: null, source: null };
}

export function parseCityFromDisplayAddress(text: string | null | undefined): string | null {
  if (text == null) return null;
  const t = text.replace(/\s+/g, " ").trim();
  const comma = t.indexOf(",");
  if (comma > 0) {
    const city = t.slice(0, comma).trim();
    return city.length >= 2 ? city : null;
  }
  return null;
}

/** Extract structured locality from a Nominatim `address` object. */
export function localityFromNominatimAddress(
  addr: Record<string, string | undefined>,
): DeliveryDestinationLocality {
  const pick = (...keys: string[]): string | null => {
    for (const key of keys) {
      const v = addr[key];
      if (typeof v === "string" && v.trim() !== "") return v.trim();
    }
    return null;
  };

  return {
    city: pick("city", "town", "village", "municipality"),
    district: pick("suburb", "city_district", "district", "borough", "neighbourhood"),
    region: pick("state", "county", "region", "state_district"),
    country: pick("country"),
  };
}
