import type { YandexClaimsInfoResponseBody } from "../dto/yandexClaimsInfoDto.js";

export type YandexClaimSnapshot = {
  providerClaimId: string;
  providerStatus: string;
  providerUpdatedAt: Date;
  courierName: string | null;
  courierPhone: string | null;
  vehicleNumber: string | null;
  etaMinutes: number | null;
  trackingUrl: string | null;
  courierLat: number | null;
  courierLng: number | null;
};

function parseUpdatedAt(raw: string | undefined, fallback: Date): Date {
  if (!raw?.trim()) return fallback;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? new Date(ts) : fallback;
}

function etaFromInterval(interval: { from?: string; to?: string } | undefined): number | null {
  if (!interval) return null;
  const toMs = interval.to ? Date.parse(interval.to) : NaN;
  if (!Number.isFinite(toMs)) return null;
  const minutes = Math.round((toMs - Date.now()) / 60_000);
  return minutes > 0 ? minutes : null;
}

function findTrackingUrl(body: YandexClaimsInfoResponseBody): string | null {
  const points = body.route_points;
  if (!Array.isArray(points)) return null;
  for (const point of points) {
    const link = point.sharing_link?.trim();
    if (link) return link;
  }
  return null;
}

function findCourierCoords(
  body: YandexClaimsInfoResponseBody,
): { lat: number | null; lng: number | null } {
  const points = body.route_points;
  if (!Array.isArray(points)) return { lat: null, lng: null };
  for (const point of points) {
    const coords = point.address?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const lng = coords[0];
      const lat = coords[1];
      if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }
  }
  return { lat: null, lng: null };
}

/** Map claims/info response to internal snapshot (no PII in logs). */
export function mapClaimsInfoResponse(
  body: YandexClaimsInfoResponseBody,
  fallbackUpdatedAt?: Date,
): YandexClaimSnapshot | null {
  const providerClaimId = body.claim_id?.trim() || body.id?.trim() || "";
  const providerStatus = body.status?.trim() || "";
  if (providerClaimId === "" || providerStatus === "") return null;

  const fallback = fallbackUpdatedAt ?? new Date();
  const providerUpdatedAt = parseUpdatedAt(body.updated_ts, fallback);
  const performer = body.performer_info;
  const coords = findCourierCoords(body);

  return {
    providerClaimId,
    providerStatus,
    providerUpdatedAt,
    courierName: performer?.courier_name?.trim() || null,
    courierPhone: null,
    vehicleNumber: performer?.car_number?.trim() || null,
    etaMinutes: etaFromInterval(body.same_day_data?.delivery_interval),
    trackingUrl: findTrackingUrl(body),
    courierLat: coords.lat,
    courierLng: coords.lng,
  };
}

export function mockClaimsInfoResponse(
  claimId: string,
  status: string,
  updatedAt: Date,
): YandexClaimSnapshot {
  return {
    providerClaimId: claimId,
    providerStatus: status,
    providerUpdatedAt: updatedAt,
    courierName: status === "performer_found" ? "Mock Courier" : null,
    courierPhone: null,
    vehicleNumber: status === "performer_found" ? "MOCK001" : null,
    etaMinutes: status === "delivering" ? 8 : null,
    trackingUrl: null,
    courierLat: null,
    courierLng: null,
  };
}
