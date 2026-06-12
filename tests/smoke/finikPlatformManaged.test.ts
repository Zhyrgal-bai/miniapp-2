import { afterEach, describe, expect, it } from "vitest";
import {
  isFinikPlatformManagedMerchantsEnabled,
  isMerchantFinikCheckoutReady,
  isMerchantFinikPlatformManaged,
  isPlatformFinikEnvReady,
  resolveMerchantFinikMode,
} from "../../src/server/finik/resolveFinikTenantCredentials.js";
import {
  canCreateFinikPayment,
  canUseOfficialFinikCreate,
  isFinikCredentialsReady,
  isMerchantStorefrontFinikCheckoutAllowed,
} from "../../src/shared/finikReady.js";
import { parseFinikRegistrationFields } from "../../src/shared/finikRegistration.js";

describe("finik platform-managed merchants", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  function setPlatformEnv(): void {
    delete process.env.FINIK_USE_MOCK;
    process.env.FINIK_PLATFORM_MANAGED_MERCHANTS = "1";
    process.env.FINIK_API_KEY = "platform-key";
    process.env.FINIK_ACCOUNT_ID = "platform-acct";
    process.env.FINIK_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nX\n-----END PRIVATE KEY-----";
    process.env.FINIK_PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----\nY\n-----END PUBLIC KEY-----";
  }

  it("feature flag detects enabled values", () => {
    delete process.env.FINIK_PLATFORM_MANAGED_MERCHANTS;
    expect(isFinikPlatformManagedMerchantsEnabled()).toBe(false);
    process.env.FINIK_PLATFORM_MANAGED_MERCHANTS = "1";
    expect(isFinikPlatformManagedMerchantsEnabled()).toBe(true);
    process.env.FINIK_PLATFORM_MANAGED_MERCHANTS = "true";
    expect(isFinikPlatformManagedMerchantsEnabled()).toBe(true);
  });

  it("legacy merchants with api key + secret stay on legacy path", () => {
    setPlatformEnv();
    const business = {
      finikApiKey: "merchant-key",
      finikAccountId: "merchant-acct",
      finikSecret: "merchant-secret",
    };
    expect(resolveMerchantFinikMode(business)).toBe("legacy_merchant_keys");
    expect(isMerchantFinikPlatformManaged(business)).toBe(false);
    expect(canCreateFinikPayment(business)).toBe(true);
  });

  it("platform-managed merchant needs only account id and platform env", () => {
    setPlatformEnv();
    const business = {
      finikApiKey: null,
      finikAccountId: "merchant-acct",
      finikSecret: null,
    };
    expect(resolveMerchantFinikMode(business)).toBe("platform_managed");
    expect(isMerchantFinikPlatformManaged(business)).toBe(true);
    expect(isPlatformFinikEnvReady()).toBe(true);
    expect(isMerchantFinikCheckoutReady(business)).toBe(true);
    expect(isFinikCredentialsReady(null, "merchant-acct", null)).toBe(true);
    expect(canUseOfficialFinikCreate(business)).toBe(true);
    expect(canCreateFinikPayment(business)).toBe(true);
    expect(isMerchantStorefrontFinikCheckoutAllowed(business)).toBe(true);
  });

  it("platform-managed blocked when platform env incomplete", () => {
    setPlatformEnv();
    delete process.env.FINIK_PUBLIC_KEY;
    const business = {
      finikApiKey: null,
      finikAccountId: "merchant-acct",
      finikSecret: null,
    };
    expect(isPlatformFinikEnvReady()).toBe(false);
    expect(isMerchantFinikCheckoutReady(business)).toBe(false);
    expect(canCreateFinikPayment(business)).toBe(false);
  });

  it("registration accepts account id only when flag on", () => {
    setPlatformEnv();
    expect(parseFinikRegistrationFields({ finikAccountId: "acct-5678" })).toEqual({
      ok: true,
      skip: false,
      finikAccountId: "acct-5678",
    });
    expect(parseFinikRegistrationFields({ finikApiKey: "key-1234" }).ok).toBe(false);
  });
});
