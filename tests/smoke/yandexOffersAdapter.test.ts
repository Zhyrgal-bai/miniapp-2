import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildYandexOffersCalculateRequest,
  calculateOffers,
  mapYandexOffersResponse,
} from "../../src/server/delivery/providers/yandex/adapters/yandexOffersAdapter.js";

const sampleInput = {
  pickup: {
    address: "Бишкек, пр. Чуй 123",
    coordinates: { longitude: 74.5698, latitude: 42.8746 },
  },
  delivery: {
    address: "Бишкек, ул. Ибраимова 103",
    coordinates: { longitude: 74.6122, latitude: 42.8765 },
  },
  item: {
    weightKg: 2,
    size: { lengthM: 0.3, widthM: 0.2, heightM: 0.1 },
    quantity: 1,
  },
} as const;

describe("yandexOffersAdapter", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    process.env.YANDEX_DELIVERY_USE_MOCK = "1";
    delete process.env.YANDEX_DELIVERY_OAUTH_TOKEN;
  });

  afterEach(() => {
    process.env = { ...envBackup };
    vi.restoreAllMocks();
  });

  it("buildYandexOffersCalculateRequest uses lon/lat order and default taxi classes", () => {
    const body = buildYandexOffersCalculateRequest(sampleInput);
    expect(body.route_points).toHaveLength(2);
    expect(body.route_points[0]?.coordinates).toEqual([74.5698, 42.8746]);
    expect(body.route_points[1]?.coordinates).toEqual([74.6122, 42.8765]);
    expect(body.items[0]?.pickup_point).toBe(1);
    expect(body.items[0]?.dropoff_point).toBe(2);
    expect(body.requirements.taxi_classes).toEqual(["courier", "express"]);
  });

  it("mapYandexOffersResponse normalizes offers and keeps payload", () => {
    const offers = mapYandexOffersResponse({
      offers: [
        {
          taxi_class: "express",
          description: "express_30min",
          payload: "payload-abc",
          price: {
            total_price: "250",
            total_price_with_vat: "280",
            currency: "KGS",
          },
          pickup_interval: {
            from: "2026-06-10T10:00:00+00:00",
            to: "2026-06-10T10:30:00+00:00",
          },
          delivery_interval: {
            from: "2026-06-10T10:30:00+00:00",
            to: "2026-06-10T11:00:00+00:00",
          },
          offer_ttl: "2026-06-10T11:30:00+00:00",
        },
      ],
    });

    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      id: "express:express_30min",
      name: "Экспресс",
      description: "express_30min",
      price: 280,
      currency: "KGS",
      payload: "payload-abc",
      expiresAt: "2026-06-10T11:30:00+00:00",
    });
    expect(offers[0]?.pickupEta?.from).toContain("2026-06-10");
  });

  it("calculateOffers returns mock offers when YANDEX_DELIVERY_USE_MOCK=1", async () => {
    const result = await calculateOffers(sampleInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.offers.length).toBeGreaterThanOrEqual(1);
    expect(result.offers[0]?.payload).toContain("mock_payload");
  });

  it("calculateOffers maps 409 tariffs_unavailable", async () => {
    delete process.env.YANDEX_DELIVERY_USE_MOCK;
    process.env.YANDEX_DELIVERY_OAUTH_TOKEN = "test-token";

    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "errors.suitable_offer_not_found",
          message: "No suitable offer",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await calculateOffers(sampleInput, { fetchImpl });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("tariffs_unavailable");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("calculateOffers handles timeout", async () => {
    delete process.env.YANDEX_DELIVERY_USE_MOCK;
    process.env.YANDEX_DELIVERY_OAUTH_TOKEN = "test-token";
    process.env.YANDEX_DELIVERY_TIMEOUT_MS = "50";

    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init.signal;
          if (signal) {
            signal.addEventListener("abort", () => {
              const err = new Error("Aborted");
              err.name = "AbortError";
              reject(err);
            });
          }
        }),
    );

    const result = await calculateOffers(sampleInput, { fetchImpl });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("timeout");
  });

  it("calculateOffers rejects invalid coordinates", async () => {
    const result = await calculateOffers({
      ...sampleInput,
      pickup: {
        ...sampleInput.pickup,
        coordinates: { longitude: NaN, latitude: 42 },
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_error");
  });
});
