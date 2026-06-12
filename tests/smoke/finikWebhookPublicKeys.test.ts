import { afterEach, describe, expect, it } from "vitest";
import {
  FINIK_ACQUIRING_PROD_WEBHOOK_PUBLIC_KEY,
  getFinikWebhookVerifyPublicKey,
  isFinikWebhookVerifyPublicKeyConfigured,
} from "../../src/server/finik/finikWebhookPublicKeys.js";

describe("finikWebhookPublicKeys", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("uses embedded Finik prod webhook key when FINIK_API_URL is production", () => {
    delete process.env.FINIK_WEBHOOK_PUBLIC_KEY;
    delete process.env.FINIK_ACQUIRING_WEBHOOK_PUBLIC_KEY;
    process.env.FINIK_API_URL = "https://api.acquiring.averspay.kg/payment";
    expect(getFinikWebhookVerifyPublicKey()).toBe(
      FINIK_ACQUIRING_PROD_WEBHOOK_PUBLIC_KEY,
    );
    expect(isFinikWebhookVerifyPublicKeyConfigured()).toBe(true);
  });

  it("prefers explicit FINIK_WEBHOOK_PUBLIC_KEY override", () => {
    process.env.FINIK_API_URL = "https://api.acquiring.averspay.kg/payment";
    process.env.FINIK_WEBHOOK_PUBLIC_KEY =
      "-----BEGIN PUBLIC KEY-----\\nCUSTOM\\n-----END PUBLIC KEY-----";
    expect(getFinikWebhookVerifyPublicKey()).toContain("CUSTOM");
  });
});
