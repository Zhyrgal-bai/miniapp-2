import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as structuredLog from "../../src/server/structuredLog.js";
import { YandexClaimsCreateService } from "../../src/server/delivery/providers/yandex/services/YandexClaimsCreateService.js";
import type { YandexHttpFetch } from "../../src/server/delivery/providers/yandex/client/yandexHttpClient.js";

const baseInput = {
  offerPayload: "offer-payload-abc",
  pickup: {
    address: "Store",
    coordinates: { latitude: 42.87, longitude: 74.57 },
  },
  delivery: {
    address: "Customer",
    coordinates: { latitude: 42.88, longitude: 74.58 },
    contactName: "Test",
    contactPhone: "+996700000000",
  },
  weightKg: 1,
};

const ctx = { merchantId: 10, orderId: 99 };

describe("YandexClaimsCreateService", () => {
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

  it("returns mock claim id when mock mode enabled", async () => {
    process.env.YANDEX_DELIVERY_USE_MOCK = "1";
    const service = new YandexClaimsCreateService();
    const result = await service.create(baseInput, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.providerClaimId).toMatch(/^mock_claim_/);
      expect(result.internalPayload.claim_id).toBe(result.providerClaimId);
    }
  });

  it("rejects invalid input", async () => {
    const service = new YandexClaimsCreateService();
    const result = await service.create(
      { ...baseInput, offerPayload: "" },
      ctx,
    );
    expect(result).toEqual({
      ok: false,
      code: "validation_error",
      error: "offerPayload is required",
    });
  });

  it("creates claim via HTTP client", async () => {
    const fetchImpl: YandexHttpFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ claim_id: "claim-123", status: "new" }),
    });

    const service = new YandexClaimsCreateService();
    const result = await service.create(baseInput, ctx, { fetchImpl });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.providerClaimId).toBe("claim-123");
    }
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("maps 503 to api_error", async () => {
    const fetchImpl: YandexHttpFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => JSON.stringify({ code: "service_unavailable", message: "down" }),
    });

    const service = new YandexClaimsCreateService();
    const result = await service.create(baseInput, ctx, { fetchImpl });
    expect(result).toMatchObject({ ok: false, code: "api_error" });
  });

  it("maps 429 to rate_limited", async () => {
    const fetchImpl: YandexHttpFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ code: "too_many_requests", message: "slow down" }),
    });

    const service = new YandexClaimsCreateService();
    const result = await service.create(baseInput, ctx, { fetchImpl });
    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
  });
});
