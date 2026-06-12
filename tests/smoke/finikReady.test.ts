import { afterEach, describe, expect, it } from "vitest";
import {
  buildFinikWebhookUrl,
  canCreateFinikPayment,
  canUseLegacyFinikCreate,
  canUseOfficialFinikCreate,
  finikUseMockForBusiness,
  isFinikCredentialsReady,
  isFinikLegacyHttpReady,
  isFinikOfficialPrivateKeyConfigured,
  isFinikUseMockEnabled,
  isMerchantStorefrontFinikCheckoutAllowed,
} from "../../src/shared/finikReady.js";

describe("finikReady", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("requires api key and account id when mock is off", () => {
    delete process.env.FINIK_USE_MOCK;
    expect(isFinikCredentialsReady("key-1234", "acct-5678")).toBe(true);
    expect(isFinikCredentialsReady("key-1234", null)).toBe(false);
    expect(isFinikCredentialsReady(null, "acct-5678")).toBe(false);
  });

  it("legacy http requires api key and secret when mock is off", () => {
    delete process.env.FINIK_USE_MOCK;
    expect(isFinikLegacyHttpReady("key-1234", "secret-5678")).toBe(true);
    expect(isFinikLegacyHttpReady("key-1234", null)).toBe(false);
    expect(canUseLegacyFinikCreate({ finikApiKey: "k", finikSecret: "s" })).toBe(
      true,
    );
  });

  it("mock mode marks credentials ready without keys", () => {
    process.env.FINIK_USE_MOCK = "1";
    expect(isFinikUseMockEnabled()).toBe(true);
    expect(isFinikCredentialsReady(null, null)).toBe(true);
    expect(canCreateFinikPayment({ finikApiKey: null, finikAccountId: null, finikSecret: null })).toBe(
      true,
    );
    expect(canUseOfficialFinikCreate({ finikApiKey: "k", finikAccountId: "a" })).toBe(
      false,
    );
  });

  it("official create requires api key, account id and server private key", () => {
    delete process.env.FINIK_USE_MOCK;
    delete process.env.FINIK_RSA_PRIVATE_KEY;
    delete process.env.FINIK_PRIVATE_KEY;
    delete process.env.FINIK_RSA_PRIVATE_KEY_PATH;

    const biz = { finikApiKey: "k", finikAccountId: "a" };
    expect(isFinikOfficialPrivateKeyConfigured()).toBe(false);
    expect(canUseOfficialFinikCreate(biz)).toBe(false);

    process.env.FINIK_RSA_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nX\\n-----END PRIVATE KEY-----";
    expect(isFinikOfficialPrivateKeyConfigured()).toBe(true);
    expect(canUseOfficialFinikCreate(biz)).toBe(true);
  });

  it("canCreateFinikPayment is official OR legacy", () => {
    delete process.env.FINIK_USE_MOCK;
    delete process.env.FINIK_RSA_PRIVATE_KEY;
    delete process.env.FINIK_PRIVATE_KEY;
    delete process.env.FINIK_RSA_PRIVATE_KEY_PATH;

    const officialOnly = {
      finikApiKey: "k",
      finikAccountId: "a",
      finikSecret: null,
    };
    expect(canCreateFinikPayment(officialOnly)).toBe(false);

    process.env.FINIK_RSA_PRIVATE_KEY = "pem";
    expect(canCreateFinikPayment(officialOnly)).toBe(true);
    expect(canUseLegacyFinikCreate(officialOnly)).toBe(false);

    delete process.env.FINIK_RSA_PRIVATE_KEY;
    const legacyOnly = {
      finikApiKey: "k",
      finikAccountId: null,
      finikSecret: "s",
    };
    expect(canCreateFinikPayment(legacyOnly)).toBe(true);
    expect(canUseOfficialFinikCreate(legacyOnly)).toBe(false);

    const both = {
      finikApiKey: "k",
      finikAccountId: "a",
      finikSecret: "s",
    };
    process.env.FINIK_PRIVATE_KEY = "pem";
    expect(canCreateFinikPayment(both)).toBe(true);
    expect(canUseOfficialFinikCreate(both)).toBe(true);
    expect(canUseLegacyFinikCreate(both)).toBe(true);
  });

  it("readiness gate: key+account without secret passes when official signing configured", () => {
    delete process.env.FINIK_USE_MOCK;
    process.env.FINIK_RSA_PRIVATE_KEY = "pem";

    const business = {
      finikApiKey: "k",
      finikAccountId: "a",
      finikSecret: null,
    };
    expect(isFinikCredentialsReady(business.finikApiKey, business.finikAccountId)).toBe(
      true,
    );
    expect(canCreateFinikPayment(business)).toBe(true);
  });

  it("readiness gate: key+account without secret or signing key still blocked", () => {
    delete process.env.FINIK_USE_MOCK;
    delete process.env.FINIK_RSA_PRIVATE_KEY;
    delete process.env.FINIK_PRIVATE_KEY;
    delete process.env.FINIK_RSA_PRIVATE_KEY_PATH;

    const business = {
      finikApiKey: "k",
      finikAccountId: "a",
      finikSecret: null,
    };
    expect(isFinikCredentialsReady(business.finikApiKey, business.finikAccountId)).toBe(
      true,
    );
    expect(canCreateFinikPayment(business)).toBe(false);
  });

  it("mock gate uses account id not secret", () => {
    delete process.env.FINIK_USE_MOCK;
    expect(
      finikUseMockForBusiness({
        finikApiKey: "k",
        finikAccountId: "a",
      }),
    ).toBe(false);
    expect(
      finikUseMockForBusiness({
        finikApiKey: "k",
        finikAccountId: null,
      }),
    ).toBe(true);
  });

  it("builds webhook url from origin and business id", () => {
    expect(buildFinikWebhookUrl("https://api.example.com/", 42)).toBe(
      "https://api.example.com/finik/webhook/42",
    );
    expect(buildFinikWebhookUrl("", 1)).toBeNull();
  });

  it("platform-managed merchant ready with account id only when flag and env set", () => {
    delete process.env.FINIK_USE_MOCK;
    process.env.FINIK_PLATFORM_MANAGED_MERCHANTS = "1";
    process.env.FINIK_API_KEY = "platform-key";
    process.env.FINIK_ACCOUNT_ID = "platform-acct";
    process.env.FINIK_PRIVATE_KEY = "pem";
    process.env.FINIK_PUBLIC_KEY = "pub";

    const business = {
      finikApiKey: null,
      finikAccountId: "merchant-acct",
      finikSecret: null,
    };
    expect(isFinikCredentialsReady(null, "merchant-acct", null)).toBe(true);
    expect(canCreateFinikPayment(business)).toBe(true);
    expect(isMerchantStorefrontFinikCheckoutAllowed(business)).toBe(true);
  });

  it("storefront checkout blocked without keys or mock adapter", () => {
    delete process.env.FINIK_USE_MOCK;
    delete process.env.FINIK_RSA_PRIVATE_KEY;
    const noKeys = {
      finikApiKey: null,
      finikAccountId: null,
      finikSecret: null,
    };
    expect(isMerchantStorefrontFinikCheckoutAllowed(noKeys)).toBe(false);

    process.env.FINIK_USE_MOCK = "1";
    expect(
      isMerchantStorefrontFinikCheckoutAllowed({
        finikApiKey: "k",
        finikAccountId: "a",
        finikSecret: "s",
      }),
    ).toBe(false);

    delete process.env.FINIK_USE_MOCK;
    process.env.FINIK_RSA_PRIVATE_KEY = "pem";
    expect(
      isMerchantStorefrontFinikCheckoutAllowed({
        finikApiKey: "k",
        finikAccountId: "a",
        finikSecret: null,
      }),
    ).toBe(true);
  });
});
