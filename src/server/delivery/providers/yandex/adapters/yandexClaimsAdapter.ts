import type {
  YandexClaimsAcceptResponseBody,
  YandexClaimsApiErrorBody,
  YandexClaimsCreateRequestBody,
  YandexClaimsCreateResponseBody,
} from "../dto/yandexClaimsDto.js";
import { getYandexDeliveryWebhookBaseUrl } from "../services/yandexDeliveryConfig.js";

const PICKUP_POINT_ID = 1;
const DROPOFF_POINT_ID = 2;

export type YandexClaimsCreateInput = {
  offerPayload: string;
  pickup: {
    address: string;
    coordinates: { latitude: number; longitude: number };
    contactName?: string;
    contactPhone?: string;
  };
  delivery: {
    address: string;
    coordinates: { latitude: number; longitude: number };
    contactName: string;
    contactPhone: string;
  };
  weightKg: number;
};

export type YandexClaimsCreateSuccess = {
  ok: true;
  providerClaimId: string;
  internalPayload: Record<string, string>;
};

export type YandexClaimsCreateFailure = {
  ok: false;
  code:
    | "validation_error"
    | "timeout"
    | "network_error"
    | "rate_limited"
    | "api_error"
    | "not_configured";
  error: string;
  details?: Record<string, string>;
};

export type YandexClaimsCreateResult =
  | YandexClaimsCreateSuccess
  | YandexClaimsCreateFailure;

export type YandexClaimsAcceptSuccess = {
  ok: true;
  providerClaimId: string;
  status: string;
  internalPayload: Record<string, string>;
};

export type YandexClaimsAcceptFailure = YandexClaimsCreateFailure;

export type YandexClaimsAcceptResult =
  | YandexClaimsAcceptSuccess
  | YandexClaimsAcceptFailure;

function isFiniteCoord(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function validateClaimsCreateInput(input: YandexClaimsCreateInput): string | null {
  if (!input.offerPayload?.trim()) return "offerPayload is required";
  if (!input.pickup.address?.trim()) return "pickup.address is required";
  if (!input.delivery.address?.trim()) return "delivery.address is required";
  if (
    !isFiniteCoord(input.pickup.coordinates.latitude) ||
    !isFiniteCoord(input.pickup.coordinates.longitude)
  ) {
    return "pickup.coordinates invalid";
  }
  if (
    !isFiniteCoord(input.delivery.coordinates.latitude) ||
    !isFiniteCoord(input.delivery.coordinates.longitude)
  ) {
    return "delivery.coordinates invalid";
  }
  if (!isFiniteCoord(input.weightKg) || input.weightKg <= 0) {
    return "weightKg must be positive";
  }
  return null;
}

export function buildYandexClaimsCreateRequest(
  input: YandexClaimsCreateInput,
): YandexClaimsCreateRequestBody {
  const pickupPoint: YandexClaimsCreateRequestBody["route_points"][number] = {
    id: PICKUP_POINT_ID,
    coordinates: [
      input.pickup.coordinates.longitude,
      input.pickup.coordinates.latitude,
    ],
    fullname: input.pickup.address.trim(),
  };
  if (input.pickup.contactName && input.pickup.contactPhone) {
    pickupPoint.contact = {
      name: input.pickup.contactName.trim(),
      phone: input.pickup.contactPhone.trim(),
    };
  }

  return {
    offer_payload: input.offerPayload.trim(),
    route_points: [
      pickupPoint,
      {
        id: DROPOFF_POINT_ID,
        coordinates: [
          input.delivery.coordinates.longitude,
          input.delivery.coordinates.latitude,
        ],
        fullname: input.delivery.address.trim(),
        contact: {
          name: input.delivery.contactName.trim(),
          phone: input.delivery.contactPhone.trim(),
        },
      },
    ],
    items: [
      {
        weight: input.weightKg,
        quantity: 1,
        pickup_point: PICKUP_POINT_ID,
        dropoff_point: DROPOFF_POINT_ID,
      },
    ],
    ...(buildCallbackProperties() ? { callback_properties: buildCallbackProperties()! } : {}),
  };
}

function buildCallbackProperties(): { callback_url: string } | null {
  const base = getYandexDeliveryWebhookBaseUrl();
  if (base === "") return null;
  const url = base.endsWith("?") ? base : `${base}?`;
  return { callback_url: url };
}

export function mapClaimsCreateResponse(
  body: YandexClaimsCreateResponseBody,
): { providerClaimId: string; status: string } | null {
  const id = body.claim_id?.trim() || body.id?.trim() || "";
  if (id === "") return null;
  return {
    providerClaimId: id,
    status: body.status?.trim() || "new",
  };
}

export function mapClaimsAcceptResponse(
  body: YandexClaimsAcceptResponseBody,
): { providerClaimId: string; status: string } | null {
  const id = body.claim_id?.trim() || body.id?.trim() || "";
  if (id === "") return null;
  return {
    providerClaimId: id,
    status: body.status?.trim() || "accepted",
  };
}

export function mapClaimsApiError(
  status: number,
  body: YandexClaimsApiErrorBody,
): YandexClaimsCreateFailure {
  const code = body.code?.trim() || "api_error";
  const message = body.message?.trim() || `Yandex API error (${status})`;

  if (status === 429) {
    return { ok: false, code: "rate_limited", error: message, details: { yandexCode: code } };
  }
  if (status === 400) {
    return { ok: false, code: "validation_error", error: message, details: { yandexCode: code } };
  }
  return {
    ok: false,
    code: "api_error",
    error: message,
    details: { yandexCode: code, httpStatus: String(status) },
  };
}

export function mockClaimsCreateResponse(
  input: YandexClaimsCreateInput,
): YandexClaimsCreateSuccess {
  const claimId = `mock_claim_${Date.now()}`;
  return {
    ok: true,
    providerClaimId: claimId,
    internalPayload: {
      claim_id: claimId,
      status: "new",
      offer_ref: input.offerPayload.slice(0, 32),
    },
  };
}

export function mockClaimsAcceptResponse(claimId: string): YandexClaimsAcceptSuccess {
  return {
    ok: true,
    providerClaimId: claimId,
    status: "accepted",
    internalPayload: {
      claim_id: claimId,
      status: "accepted",
    },
  };
}
