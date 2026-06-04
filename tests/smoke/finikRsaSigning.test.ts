import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canonicalFinikRequestBody,
  isFinikRsaPrivateKeyConfigured,
  loadFinikRsaPrivateKeyPem,
  signFinikOfficialRequest,
} from "../../src/server/finik/finikRsaSigning.js";
import { reloadFinikKeysFromEnv } from "../../src/server/finik/finikKeys.js";

vi.mock("@mancho.devs/authorizer", () => ({
  Signer: class MockSigner {
    async sign(): Promise<string> {
      return "mock-base64-signature";
    }
  },
}));

describe("finikRsaSigning", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    reloadFinikKeysFromEnv();
  });

  it("canonicalFinikRequestBody sorts top-level keys", () => {
    const json = canonicalFinikRequestBody({
      RedirectUrl: "https://example.com",
      Amount: 100,
      CardType: "FINIK_QR",
    });
    expect(json).toBe(
      '{"Amount":100,"CardType":"FINIK_QR","RedirectUrl":"https://example.com"}',
    );
  });

  it("isFinikRsaPrivateKeyConfigured detects FINIK_RSA_PRIVATE_KEY", () => {
    delete process.env.FINIK_RSA_PRIVATE_KEY_PATH;
    delete process.env.FINIK_PRIVATE_KEY;
    reloadFinikKeysFromEnv();
    process.env.FINIK_RSA_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nX\\n-----END PRIVATE KEY-----";
    expect(isFinikRsaPrivateKeyConfigured()).toBe(true);
    expect(loadFinikRsaPrivateKeyPem()).toContain("BEGIN PRIVATE KEY");
  });

  it("signFinikOfficialRequest returns signature and bodyJson", async () => {
    process.env.FINIK_RSA_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nX\\n-----END PRIVATE KEY-----";
    reloadFinikKeysFromEnv();

    const out = await signFinikOfficialRequest({
      host: "beta.api.acquiring.averspay.kg",
      path: "/v1/payment",
      apiKey: "test-api-key",
      body: {
        Amount: 50,
        CardType: "FINIK_QR",
        PaymentId: "00000000-0000-0000-0000-000000000001",
        RedirectUrl: "https://example.com/ok",
        Data: {
          accountId: "acct-1",
          merchantCategoryCode: "0742",
          name_en: "shop",
          webhookUrl: "https://api.example.com/finik/webhook/1",
        },
      },
    });

    expect(out.signature).toBe("mock-base64-signature");
    expect(out.timestamp).toMatch(/^\d+$/);
    expect(out.bodyJson).toContain('"Amount":50');
    expect(out.bodyJson).toContain("FINIK_QR");
  });
});
