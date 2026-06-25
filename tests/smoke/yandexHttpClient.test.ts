import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createYandexHttpClient } from "../../src/server/delivery/providers/yandex/client/yandexHttpClient.js";
import type { YandexDeliveryConfig } from "../../src/server/delivery/providers/yandex/services/yandexDeliveryConfig.js";
import * as structuredLog from "../../src/server/structuredLog.js";

const TEST_TOKEN = "test-oauth-token-secret";

const baseConfig: YandexDeliveryConfig = Object.freeze({
  apiBaseUrl: "https://b2b.taxi.yandex.net",
  offersPath: "/b2b/cargo/integration/v2/offers/calculate",
  oauthToken: TEST_TOKEN,
  useMock: false,
  timeoutMs: 5_000,
  maxRetries: 2,
  retryBaseMs: 100,
  configured: true,
});

describe("yandexHttpClient", () => {
  beforeEach(() => {
    vi.spyOn(structuredLog, "emitStructuredLog").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("sends Bearer auth, JSON body, and X-Request-Id on successful POST", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ offers: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = createYandexHttpClient(baseConfig, { fetchImpl });
    const result = await client.post<{ offers: unknown[] }>(
      baseConfig.offersPath,
      { hello: "world" },
      { requestId: "req-123" },
    );

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TEST_TOKEN}`);
    expect(headers["X-Request-Id"]).toBe("req-123");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ hello: "world" }));
  });

  it("does not log OAuth token in structured logs", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const logSpy = vi.spyOn(structuredLog, "emitStructuredLog");

    const client = createYandexHttpClient(baseConfig, { fetchImpl });
    await client.post(baseConfig.offersPath, {});

    for (const call of logSpy.mock.calls) {
      const serialized = JSON.stringify(call);
      expect(serialized).not.toContain(TEST_TOKEN);
    }
  });

  it("retries on 503 then succeeds", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("unavailable", { status: 503 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ offers: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const client = createYandexHttpClient(baseConfig, { fetchImpl });
    const promise = client.post(baseConfig.offersPath, {});

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 401", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = createYandexHttpClient(baseConfig, { fetchImpl });
    const result = await client.post(baseConfig.offersPath, {});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("http");
    expect(result.status).toBe(401);
    expect(result.retryable).toBe(false);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("maps AbortError to timeout kind", async () => {
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

    const client = createYandexHttpClient(
      { ...baseConfig, timeoutMs: 30 },
      { fetchImpl },
    );
    const result = await client.post(baseConfig.offersPath, {});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("timeout");
    expect(result.retryable).toBe(true);
  });

  it("returns parse_error for malformed JSON on 200", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("not-json", { status: 200 }),
    );

    const client = createYandexHttpClient(baseConfig, { fetchImpl });
    const result = await client.post(baseConfig.offersPath, {});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("parse_error");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
