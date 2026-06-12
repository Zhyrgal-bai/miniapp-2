import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOfficialFinikPaymentStatus } from "../../src/server/finik/officialAcquiringStatusAdapter.js";
import * as finikRsaSigning from "../../src/server/finik/finikRsaSigning.js";

describe("officialAcquiringStatusAdapter", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    vi.restoreAllMocks();
  });

  it("GETs signed status URL and normalizes SUCCEEDED", async () => {
    process.env.FINIK_RSA_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\\nX\\n-----END PRIVATE KEY-----";
    process.env.FINIK_OFFICIAL_ACQUIRING_STATUS_PATH =
      "/v1/payment/{paymentId}";

    vi.spyOn(finikRsaSigning, "signFinikOfficialGetRequest").mockResolvedValue({
      signature: "sig",
      timestamp: "1730000000000",
    });

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "SUCCEEDED", amount: 500 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const out = await fetchOfficialFinikPaymentStatus(
      { finikApiKey: "test-key", finikAccountId: "acct", finikSecret: null },
      "00000000-0000-0000-0000-000000000099",
    );

    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.status).toBe("succeeded");
      expect(out.amount).toBe(500);
    }

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v1/payment/00000000-0000-0000-0000-000000000099");
    expect(init.method).toBe("GET");
    expect(init.headers).toMatchObject({
      "x-api-key": "test-key",
      signature: "sig",
    });
  });

  it("returns status_not_available on Missing Authentication Token 403", async () => {
    process.env.FINIK_RSA_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\\nX\\n-----END PRIVATE KEY-----";
    process.env.FINIK_API_URL = "https://api.acquiring.averspay.kg/payment";
    delete process.env.FINIK_OFFICIAL_ACQUIRING_STATUS_PATH;

    vi.spyOn(finikRsaSigning, "signFinikOfficialGetRequest").mockResolvedValue({
      signature: "sig",
      timestamp: "1730000000000",
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ message: "Missing Authentication Token" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const out = await fetchOfficialFinikPaymentStatus(
      { finikApiKey: "test-key", finikAccountId: "acct", finikSecret: null },
      "1419bec1-0000-0000-0000-000000000099",
    );

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.code).toBe("finik_official_status_not_available");
    }
  });
});
