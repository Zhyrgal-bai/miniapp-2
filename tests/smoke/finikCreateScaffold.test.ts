import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFinikPaymentSession,
  getFinikCreateApiMode,
  getOfficialAcquiringCreateUrl,
  isOfficialAcquiringRoutingAllowed,
  legacyCreateAdapter,
  mockCreateAdapter,
  officialAcquiringCreateAdapter,
} from "../../src/server/finik/index.js";
import {
  getOfficialAcquiringBaseUrl,
  getOfficialAcquiringCreatePath,
  getOfficialAcquiringCreateUrl,
} from "../../src/server/finik/finikCreateConfig.js";
import {
  normalizeLegacyFinikCreateResponse,
  normalizeOfficialFinikCreateResponse,
} from "../../src/server/finik/finikCreateResponseNormalizer.js";
import type { FinikCreateContext } from "../../src/server/finik/finikCreateTypes.js";
import * as finikRsaSigning from "../../src/server/finik/finikRsaSigning.js";

const baseCtx: FinikCreateContext = {
  flow: "storefront_order",
  tenant: {
    kind: "business",
    businessId: 1,
    finikApiKey: "key-1234",
    finikAccountId: "acct-1",
    finikSecret: "secret-5678",
  },
  amount: 100,
  currency: "KGS",
  orderId: "42",
  externalId: "1:42",
  callbackUrl: "https://api.example.com/finik/webhook/1",
  returnUrl: "https://api.example.com/finik/webhook/1",
};

describe("finikCreateScaffold", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("defaults FINIK_CREATE_API_MODE to legacy", () => {
    delete process.env.FINIK_CREATE_API_MODE;
    expect(getFinikCreateApiMode()).toBe("legacy");
  });

  it("FINIK_API_URL alias sets official base and create url", () => {
    delete process.env.FINIK_OFFICIAL_ACQUIRING_BASE_URL;
    process.env.FINIK_API_URL = "https://api.acquiring.averspay.kg/payment";
    expect(getOfficialAcquiringBaseUrl()).toBe(
      "https://api.acquiring.averspay.kg",
    );
    expect(getOfficialAcquiringCreateUrl()).toBe(
      `https://api.acquiring.averspay.kg${getOfficialAcquiringCreatePath()}`,
    );
  });

  it("invalid mode falls back to legacy", () => {
    process.env.FINIK_CREATE_API_MODE = "unknown";
    expect(getFinikCreateApiMode()).toBe("legacy");
  });

  it("legacy mode does not route to official", () => {
    process.env.FINIK_CREATE_API_MODE = "legacy";
    delete process.env.FINIK_RSA_PRIVATE_KEY;
    expect(isOfficialAcquiringRoutingAllowed()).toBe(false);
  });

  it("defaults official create path to /v1/payment", () => {
    delete process.env.FINIK_OFFICIAL_ACQUIRING_CREATE_PATH;
    expect(getOfficialAcquiringCreatePath()).toBe("/v1/payment");
    expect(getOfficialAcquiringCreateUrl()).toBe(
      "https://beta.api.acquiring.averspay.kg/v1/payment",
    );
  });

  it("defaults official status path to /v1/payment/{paymentId}", async () => {
    const { getOfficialAcquiringStatusPath, getOfficialAcquiringStatusUrl } =
      await import("../../src/server/finik/finikCreateConfig.js");
    delete process.env.FINIK_OFFICIAL_ACQUIRING_STATUS_PATH;
    expect(getOfficialAcquiringStatusPath("uuid-1")).toBe("/v1/payment/uuid-1");
    expect(getOfficialAcquiringStatusUrl("uuid-1")).toBe(
      "https://beta.api.acquiring.averspay.kg/v1/payment/uuid-1",
    );
  });

  it("official adapter returns 201 JSON payment url", async () => {
    const signSpy = vi.spyOn(finikRsaSigning, "signFinikOfficialRequest").mockResolvedValue({
      signature: "sig",
      timestamp: "1737369012345",
      bodyJson: '{"Amount":100,"CardType":"FINIK_QR"}',
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: { get: () => null },
      json: async () => ({
        paymentId: "pay-official-1",
        paymentUrl: "https://qr.finik.kg/test",
        status: "PENDING",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await officialAcquiringCreateAdapter.createPaymentSession(baseCtx);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.apiMode).toBe("official");
      expect(out.paymentId).toBe("pay-official-1");
      expect(out.paymentUrl).toBe("https://qr.finik.kg/test");
    }
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://beta.api.acquiring.averspay.kg/v1/payment");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "content-type": "application/json",
      "x-api-key": "key-1234",
      "x-api-timestamp": "1737369012345",
      signature: "sig",
    });
    expect(init.redirect).toBe("manual");

    signSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("official mode allows official routing when RSA key is set", () => {
    process.env.FINIK_CREATE_API_MODE = "official";
    process.env.FINIK_RSA_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nX\\n-----END PRIVATE KEY-----";
    expect(isOfficialAcquiringRoutingAllowed()).toBe(true);
  });

  it("official adapter rejects missing credentials", async () => {
    const out = await officialAcquiringCreateAdapter.createPaymentSession({
      ...baseCtx,
      tenant: {
        kind: "business",
        businessId: 1,
        finikApiKey: null,
        finikAccountId: null,
        finikSecret: null,
      },
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.code).toBe("finik_official_credentials_missing");
    }
  });

  it("router uses mock when FINIK_USE_MOCK=1", async () => {
    process.env.FINIK_CREATE_API_MODE = "legacy";
    process.env.FINIK_USE_MOCK = "1";
    const out = await createFinikPaymentSession(baseCtx);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.apiMode).toBe("mock");
      expect(out.paymentId).toContain("finik_mock_");
    }
  });

  it("router with legacy mode and no mock uses legacy adapter path", async () => {
    process.env.FINIK_CREATE_API_MODE = "legacy";
    delete process.env.FINIK_USE_MOCK;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        payment_id: "pay-1",
        payment_url: "https://pay.example/1",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await createFinikPaymentSession(baseCtx);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.apiMode).toBe("legacy");
      expect(out.paymentId).toBe("pay-1");
    }
    expect(fetchMock).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("legacyCreateAdapter rejects missing secret", async () => {
    const out = await legacyCreateAdapter.createPaymentSession({
      ...baseCtx,
      tenant: {
        ...baseCtx.tenant,
        kind: "business",
        finikSecret: null,
      },
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.code).toBe("finik_legacy_credentials_missing");
    }
  });

  it("normalizes legacy response fields", () => {
    const n = normalizeLegacyFinikCreateResponse({
      id: "legacy-id",
      checkout_url: "https://checkout",
    });
    expect(n.ok).toBe(true);
    if (n.ok) {
      expect(n.paymentId).toBe("legacy-id");
      expect(n.paymentUrl).toBe("https://checkout");
    }
  });

  it("normalizes official response field aliases (scaffold map)", () => {
    const n = normalizeOfficialFinikCreateResponse({
      transactionId: "tx-9",
      shortUrl: "https://short",
    });
    expect(n.ok).toBe(true);
    if (n.ok) {
      expect(n.paymentId).toBe("tx-9");
      expect(n.paymentUrl).toBe("https://short");
    }
  });

  it("mock adapter returns payment url", async () => {
    const out = await mockCreateAdapter.createPaymentSession(baseCtx);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.apiMode).toBe("mock");
      expect(out.paymentUrl).toContain("pay.finik.kg");
    }
  });
});
