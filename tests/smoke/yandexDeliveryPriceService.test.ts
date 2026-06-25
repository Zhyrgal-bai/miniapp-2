import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as structuredLog from "../../src/server/structuredLog.js";
import { YandexDeliveryPriceService } from "../../src/server/delivery/providers/yandex/services/YandexDeliveryPriceService.js";
import type { DeliveryMerchantPickup } from "../../src/server/delivery/services/deliveryMerchantResolver.js";
import type { DeliveryMerchantResolver } from "../../src/server/delivery/services/deliveryMerchantResolver.js";

const pickup: DeliveryMerchantPickup = {
  merchantId: 42,
  address: "Бишкек, пр. Чуй 123",
  coordinates: { latitude: 42.8746, longitude: 74.5698 },
};

const destination = { latitude: 42.8765, longitude: 74.6122 };

function mockResolver(
  result:
    | { ok: true; pickup?: DeliveryMerchantPickup }
    | { ok: false; code: "delivery_disabled" | "merchant_not_found" | "merchant_unavailable" | "invalid_coordinates"; message: string },
): DeliveryMerchantResolver {
  return {
    resolve: vi.fn().mockResolvedValue(
      result.ok
        ? { ok: true, pickup: result.pickup ?? pickup }
        : result,
    ),
  };
}

function yandexOffersJson(overrides?: {
  offerTtl?: string;
  price?: string;
  taxiClass?: string;
}) {
  return {
    offers: [
      {
        taxi_class: overrides?.taxiClass ?? "express",
        description: "express_30min",
        payload: "secret-payload-do-not-expose",
        offer_ttl: overrides?.offerTtl ?? "2026-06-10T12:00:00+00:00",
        price: {
          total_price_with_vat: overrides?.price ?? "280",
          currency: "KGS",
        },
        delivery_interval: {
          from: new Date(Date.now() + 30 * 60_000).toISOString(),
          to: new Date(Date.now() + 45 * 60_000).toISOString(),
        },
      },
      {
        taxi_class: "courier",
        description: "courier_slow",
        payload: "courier-payload",
        offer_ttl: "2026-06-10T12:30:00+00:00",
        price: {
          total_price_with_vat: "200",
          currency: "KGS",
        },
        delivery_interval: {
          from: new Date(Date.now() + 40 * 60_000).toISOString(),
          to: new Date(Date.now() + 55 * 60_000).toISOString(),
        },
      },
    ],
  };
}

describe("YandexDeliveryPriceService", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    process.env.YANDEX_DELIVERY_USE_MOCK = "0";
    process.env.YANDEX_DELIVERY_OAUTH_TOKEN = "test-token";
    vi.spyOn(structuredLog, "emitStructuredLog").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...envBackup };
    vi.restoreAllMocks();
  });

  it("returns mapped quote on successful calculation", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(yandexOffersJson()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const service = new YandexDeliveryPriceService({
      resolveMerchant: mockResolver({ ok: true }),
      fetchImpl,
    });

    const result = await service.calculate({
      merchantId: 42,
      destination,
      requestId: "req-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quote).toMatchObject({
      provider: "yandex",
      available: true,
      price: 200,
      currency: "KGS",
      providerOfferId: "courier:courier_slow",
      expiresAt: "2026-06-10T12:30:00+00:00",
    });
    expect(result.quote).not.toHaveProperty("payload");
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("returns delivery_disabled when merchant has delivery turned off", async () => {
    const service = new YandexDeliveryPriceService({
      resolveMerchant: mockResolver({
        ok: false,
        code: "delivery_disabled",
        message: "Доставка в этом магазине отключена.",
      }),
    });

    const result = await service.calculate({ merchantId: 42, destination });
    expect(result).toEqual({
      ok: false,
      code: "delivery_disabled",
      message: "Доставка в этом магазине отключена.",
    });
  });

  it("rejects invalid destination coordinates", async () => {
    const service = new YandexDeliveryPriceService({
      resolveMerchant: mockResolver({ ok: true }),
    });

    const result = await service.calculate({
      merchantId: 42,
      destination: { latitude: 999, longitude: 74.6 },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid_coordinates");
  });

  it("maps provider timeout", async () => {
    process.env.YANDEX_DELIVERY_TIMEOUT_MS = "30";

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

    const service = new YandexDeliveryPriceService({
      resolveMerchant: mockResolver({ ok: true }),
      fetchImpl,
    });

    const result = await service.calculate({ merchantId: 42, destination });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("provider_timeout");
  });

  it("maps provider 429", async () => {
    const service = new YandexDeliveryPriceService({
      resolveMerchant: mockResolver({ ok: true }),
      calculateOffersFn: vi.fn().mockResolvedValue({
        ok: false,
        code: "rate_limited",
        error: "rate limited",
      }),
    });

    const result = await service.calculate({ merchantId: 42, destination });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("provider_rate_limit");
  });

  it("succeeds after provider 503 retry", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("down", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(yandexOffersJson({ price: "310" })), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const service = new YandexDeliveryPriceService({
      resolveMerchant: mockResolver({ ok: true }),
      fetchImpl,
    });

    const promise = service.calculate({ merchantId: 42, destination });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("maps tariff unavailable on provider 409", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "errors.suitable_offer_not_found",
          message: "No suitable offer",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );

    const service = new YandexDeliveryPriceService({
      resolveMerchant: mockResolver({ ok: true }),
      fetchImpl,
    });

    const result = await service.calculate({ merchantId: 42, destination });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("tariff_unavailable");
    expect(result.message).not.toContain("suitable_offer");
  });

  it("maps provider unavailable when not configured", async () => {
    delete process.env.YANDEX_DELIVERY_OAUTH_TOKEN;
    delete process.env.YANDEX_DELIVERY_USE_MOCK;

    const service = new YandexDeliveryPriceService({
      resolveMerchant: mockResolver({ ok: true }),
    });

    const result = await service.calculate({ merchantId: 42, destination });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("provider_unavailable");
  });

  it("does not log oauth token or coordinates", async () => {
    const logSpy = vi.spyOn(structuredLog, "emitStructuredLog");
    process.env.YANDEX_DELIVERY_USE_MOCK = "1";

    const service = new YandexDeliveryPriceService({
      resolveMerchant: mockResolver({ ok: true }),
    });

    await service.calculate({ merchantId: 42, destination });

    for (const call of logSpy.mock.calls) {
      const serialized = JSON.stringify(call);
      expect(serialized).not.toContain("test-token");
      expect(serialized).not.toContain(String(destination.latitude));
      expect(serialized).not.toContain(String(destination.longitude));
    }
  });
});
