import {
  createYandexHttpClient,
  type YandexHttpFetch,
} from "../client/yandexHttpClient.js";
import type {
  YandexApiErrorBody,
  YandexOffersCalculateRequestBody,
  YandexOffersCalculateResponseBody,
} from "../dto/yandexOffersDto.js";
import {
  isYandexDeliveryConfigured,
  isYandexDeliveryMockEnabled,
  loadYandexDeliveryConfig,
} from "../services/yandexDeliveryConfig.js";
import type {
  ArchaDeliveryOffer,
  YandexOffersCalculateInput,
  YandexOffersCalculateResult,
} from "../types/yandexDeliveryTypes.js";

const PICKUP_POINT_ID = 1;
const DROPOFF_POINT_ID = 2;

const TAXI_CLASS_LABELS: Record<string, string> = {
  courier: "Курьер",
  express: "Экспресс",
  cargo: "Грузовой",
};

function isFiniteCoord(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function validateInput(input: YandexOffersCalculateInput): string | null {
  if (!input.pickup.address?.trim()) return "pickup.address is required";
  if (!input.delivery.address?.trim()) return "delivery.address is required";
  if (
    !isFiniteCoord(input.pickup.coordinates.longitude) ||
    !isFiniteCoord(input.pickup.coordinates.latitude)
  ) {
    return "pickup.coordinates must be valid longitude/latitude";
  }
  if (
    !isFiniteCoord(input.delivery.coordinates.longitude) ||
    !isFiniteCoord(input.delivery.coordinates.latitude)
  ) {
    return "delivery.coordinates must be valid longitude/latitude";
  }
  if (!isFiniteCoord(input.item.weightKg) || input.item.weightKg <= 0) {
    return "item.weightKg must be a positive number";
  }
  return null;
}

/** Build Yandex offers/calculate request from ARCHA input. */
export function buildYandexOffersCalculateRequest(
  input: YandexOffersCalculateInput,
): YandexOffersCalculateRequestBody {
  const taxiClasses =
    input.requirements?.taxiClasses?.length &&
    input.requirements.taxiClasses.length > 0
      ? input.requirements.taxiClasses
      : (["courier", "express"] as const);

  const item: YandexOffersCalculateRequestBody["items"][number] = {
    weight: input.item.weightKg,
    quantity: Math.max(1, Math.round(input.item.quantity ?? 1)),
    pickup_point: PICKUP_POINT_ID,
    dropoff_point: DROPOFF_POINT_ID,
  };

  if (input.item.size) {
    item.size = {
      length: input.item.size.lengthM,
      width: input.item.size.widthM,
      height: input.item.size.heightM,
    };
  }

  const requirements: YandexOffersCalculateRequestBody["requirements"] = {
    taxi_classes: [...taxiClasses],
    skip_door_to_door: input.requirements?.skipDoorToDoor ?? false,
    pro_courier: input.requirements?.proCourier ?? false,
  };

  if (input.requirements?.cargoType) {
    requirements.cargo_type = input.requirements.cargoType;
  }
  if (input.requirements?.cargoLoaders != null) {
    requirements.cargo_loaders = input.requirements.cargoLoaders;
  }
  if (input.requirements?.cargoOptions?.length) {
    requirements.cargo_options = [...input.requirements.cargoOptions];
  }
  if (input.requirements?.due) {
    requirements.due = input.requirements.due;
  }

  return {
    route_points: [
      {
        id: PICKUP_POINT_ID,
        coordinates: [
          input.pickup.coordinates.longitude,
          input.pickup.coordinates.latitude,
        ],
        fullname: input.pickup.address.trim(),
      },
      {
        id: DROPOFF_POINT_ID,
        coordinates: [
          input.delivery.coordinates.longitude,
          input.delivery.coordinates.latitude,
        ],
        fullname: input.delivery.address.trim(),
      },
    ],
    items: [item],
    requirements,
  };
}

function parsePrice(value: string | undefined): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function intervalOrNull(
  interval: { from?: string; to?: string } | undefined,
): { from: string; to: string } | null {
  if (interval?.from && interval?.to) {
    return { from: interval.from, to: interval.to };
  }
  return null;
}

function offerName(taxiClass: string): string {
  return TAXI_CLASS_LABELS[taxiClass] ?? taxiClass;
}

function stableOfferId(
  offer: { taxi_class?: string; description?: string },
  index: number,
): string {
  const taxi = offer.taxi_class?.trim() || "offer";
  const desc = offer.description?.trim() || "";
  if (desc !== "") return `${taxi}:${desc}`;
  return `${taxi}:${index}`;
}

/** Map Yandex offers/calculate response to ARCHA format. */
export function mapYandexOffersResponse(
  body: YandexOffersCalculateResponseBody,
): ArchaDeliveryOffer[] {
  const raw = Array.isArray(body.offers) ? body.offers : [];
  const offers: ArchaDeliveryOffer[] = [];

  raw.forEach((offer, index) => {
    const payload = typeof offer.payload === "string" ? offer.payload.trim() : "";
    if (payload === "") return;

    const price =
      parsePrice(offer.price?.total_price_with_vat) ??
      parsePrice(offer.price?.total_price);
    if (price == null) return;

    const taxiClass = offer.taxi_class?.trim() || "delivery";
    const expiresAt =
      typeof offer.offer_ttl === "string" && offer.offer_ttl.trim() !== ""
        ? offer.offer_ttl.trim()
        : null;
    offers.push({
      id: stableOfferId(offer, index),
      name: offerName(taxiClass),
      description: offer.description?.trim() || null,
      price,
      currency: offer.price?.currency?.trim() || "KGS",
      pickupEta: intervalOrNull(offer.pickup_interval),
      deliveryEta: intervalOrNull(offer.delivery_interval),
      payload,
      expiresAt,
    });
  });

  return offers;
}

function parseErrorBody(rawBody: string | undefined): YandexApiErrorBody {
  if (!rawBody?.trim()) return {};
  try {
    return JSON.parse(rawBody) as YandexApiErrorBody;
  } catch {
    return {};
  }
}

function mapApiError(
  status: number,
  body: YandexApiErrorBody,
): YandexOffersCalculateResult {
  const code = body.code?.trim() || "api_error";
  const message = body.message?.trim() || `Yandex API error (${status})`;

  if (status === 400) {
    return {
      ok: false,
      code: "bad_request",
      error: message,
      details: { yandexCode: code },
    };
  }

  if (status === 409) {
    return {
      ok: false,
      code: "tariffs_unavailable",
      error: message,
      details: { yandexCode: code },
    };
  }

  if (status === 429) {
    return {
      ok: false,
      code: "rate_limited",
      error: message,
      details: { yandexCode: code },
    };
  }

  return {
    ok: false,
    code: "api_error",
    error: message,
    details: { yandexCode: code, httpStatus: String(status) },
  };
}

function mapHttpFailure(
  result: Extract<
    Awaited<ReturnType<ReturnType<typeof createYandexHttpClient>["post"]>>,
    { ok: false }
  >,
): YandexOffersCalculateResult {
  if (result.kind === "timeout") {
    return {
      ok: false,
      code: "timeout",
      error: result.error,
    };
  }

  if (result.kind === "network") {
    return {
      ok: false,
      code: "network_error",
      error: result.error,
    };
  }

  if (result.kind === "parse_error") {
    const failure: YandexOffersCalculateResult = {
      ok: false,
      code: "api_error",
      error: result.error,
    };
    if (result.status != null) {
      return { ...failure, details: { httpStatus: String(result.status) } };
    }
    return failure;
  }

  if (result.kind === "http" && result.status != null) {
    return mapApiError(result.status, parseErrorBody(result.rawBody));
  }

  return {
    ok: false,
    code: "api_error",
    error: result.error,
  };
}

function mockOffers(input: YandexOffersCalculateInput): ArchaDeliveryOffer[] {
  const due = new Date(Date.now() + 45 * 60_000).toISOString();
  const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
  const pickupFrom = new Date(Date.now() + 15 * 60_000).toISOString();
  const pickupTo = new Date(Date.now() + 35 * 60_000).toISOString();
  const deliveryFrom = new Date(Date.now() + 35 * 60_000).toISOString();
  const deliveryTo = new Date(Date.now() + 55 * 60_000).toISOString();

  return [
    {
      id: "mock:courier",
      name: "Курьер",
      description: "mock_courier",
      price: 150,
      currency: "KGS",
      pickupEta: { from: pickupFrom, to: pickupTo },
      deliveryEta: { from: deliveryFrom, to: deliveryTo },
      payload: `mock_payload_courier_${input.pickup.coordinates.latitude}_${input.delivery.coordinates.latitude}`,
      expiresAt,
    },
    {
      id: "mock:express",
      name: "Экспресс",
      description: "mock_express",
      price: 220,
      currency: "KGS",
      pickupEta: { from: pickupFrom, to: pickupTo },
      deliveryEta: { from: deliveryFrom, to: deliveryTo },
      payload: `mock_payload_express_${due}`,
      expiresAt,
    },
  ];
}

/**
 * Request delivery offers from Yandex offers/calculate API.
 * Platform-managed: Bearer token from ENV only.
 */
export async function calculateOffers(
  input: YandexOffersCalculateInput,
  options?: { fetchImpl?: YandexHttpFetch; requestId?: string; correlationId?: string },
): Promise<YandexOffersCalculateResult> {
  const validationError = validateInput(input);
  if (validationError) {
    return {
      ok: false,
      code: "validation_error",
      error: validationError,
    };
  }

  if (!isYandexDeliveryConfigured()) {
    return {
      ok: false,
      code: "not_configured",
      error:
        "Yandex Delivery is not configured. Set YANDEX_DELIVERY_OAUTH_TOKEN or YANDEX_DELIVERY_USE_MOCK=1.",
    };
  }

  if (isYandexDeliveryMockEnabled()) {
    return { ok: true, offers: mockOffers(input) };
  }

  const config = loadYandexDeliveryConfig();
  const client = createYandexHttpClient(config, {
    ...(options?.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });
  const body = buildYandexOffersCalculateRequest(input);

  const httpResult = await client.post<YandexOffersCalculateResponseBody>(
    config.offersPath,
    body,
    {
      ...(options?.requestId ? { requestId: options.requestId } : {}),
      ...(options?.correlationId ? { correlationId: options.correlationId } : {}),
    },
  );

  if (!httpResult.ok) {
    return mapHttpFailure(httpResult);
  }

  const offers = mapYandexOffersResponse(httpResult.data);
  if (offers.length === 0) {
    return {
      ok: false,
      code: "empty_offers",
      error: "No delivery offers available for this route",
    };
  }

  return { ok: true, offers };
}
