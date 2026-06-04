import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/db.js", () => ({
  prisma: {
    business: {
      findUnique: vi.fn().mockResolvedValue({ slug: null }),
    },
  },
}));

import { buildStorefrontOrderFinikCreateContext } from "../../src/server/finik/buildStorefrontOrderFinikCreateContext.js";
import { createStorefrontFinikCheckoutSession } from "../../src/server/finik/createStorefrontFinikCheckoutSession.js";
import * as finikRsaSigning from "../../src/server/finik/finikRsaSigning.js";

const business = {
  id: 7,
  finikApiKey: "merchant-key",
  finikAccountId: "merchant-acct",
  finikSecret: "merchant-secret",
};

describe("finikStorefrontCheckout", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("builds FinikCreateContext for storefront_order", () => {
    process.env.API_URL = "https://api.example.com";
    process.env.FRONT_URL = "https://shop.example.com";
    delete process.env.FINIK_USE_MOCK;

    const built = buildStorefrontOrderFinikCreateContext(business, {
      orderId: 99,
      amount: 250,
      currency: "KGS",
      correlationId: "corr-1",
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    expect(built.ctx.flow).toBe("storefront_order");
    expect(built.ctx.tenant).toEqual({
      kind: "business",
      businessId: 7,
      finikApiKey: "merchant-key",
      finikAccountId: "merchant-acct",
      finikSecret: "merchant-secret",
    });
    expect(built.ctx.amount).toBe(250);
    expect(built.ctx.currency).toBe("KGS");
    expect(built.ctx.orderId).toBe("99");
    expect(built.ctx.externalId).toBe("7:99");
    expect(built.ctx.callbackUrl).toBe(
      "https://api.example.com/finik/webhook/7",
    );
    expect(built.ctx.returnUrl).toBe(
      "https://shop.example.com/?shop=7&view=my-orders",
    );
    expect(built.ctx.returnUrl).not.toContain("/finik/webhook/");
    expect(built.ctx.correlationId).toBe("corr-1");
  });

  it("checkout mock: paymentUrl on pay.finik.kg", async () => {
    process.env.FINIK_USE_MOCK = "1";
    process.env.FINIK_CREATE_API_MODE = "legacy";

    const out = await createStorefrontFinikCheckoutSession(business, {
      orderId: 1,
      amount: 100,
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.paymentId).toMatch(/^finik_mock_/);
      expect(out.paymentUrl).toContain("https://pay.finik.kg/");
      expect(out.paymentUrl).toContain("amount=100");
    }
  });

  it("checkout legacy: returns legacy API payment id and url", async () => {
    delete process.env.FINIK_USE_MOCK;
    process.env.FINIK_CREATE_API_MODE = "legacy";
    delete process.env.FINIK_RSA_PRIVATE_KEY;
    delete process.env.FINIK_PRIVATE_KEY;
    process.env.API_URL = "https://api.example.com";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        payment_id: "legacy-pay-1",
        payment_url: "https://legacy.finik.example/checkout/1",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await createStorefrontFinikCheckoutSession(business, {
      orderId: 2,
      amount: 150,
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.paymentId).toBe("legacy-pay-1");
      expect(out.paymentUrl).toBe("https://legacy.finik.example/checkout/1");
    }
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("checkout official: returns official API payment id and url", async () => {
    delete process.env.FINIK_USE_MOCK;
    process.env.FINIK_CREATE_API_MODE = "official";
    process.env.FINIK_RSA_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nX\\n-----END PRIVATE KEY-----";
    process.env.API_URL = "https://api.example.com";

    vi.spyOn(finikRsaSigning, "signFinikOfficialRequest").mockResolvedValue({
      signature: "sig",
      timestamp: "1737369012345",
      bodyJson: "{}",
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: { get: () => null },
      json: async () => ({
        paymentId: "official-pay-1",
        paymentUrl: "https://qr.finik.kg/official/1",
        status: "PENDING",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const officialBusiness = {
      ...business,
      finikSecret: null,
    };
    const out = await createStorefrontFinikCheckoutSession(officialBusiness, {
      orderId: 3,
      amount: 200,
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.paymentId).toBe("official-pay-1");
      expect(out.paymentUrl).toBe("https://qr.finik.kg/official/1");
    }
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/v1/payment");
  });
});
