/**
 * Platform-managed vs legacy per-merchant Finik credential mode.
 * Kept free of finikReady imports to avoid circular dependencies.
 */

export type MerchantFinikMode = "platform_managed" | "legacy_merchant_keys";

export type MerchantFinikBusiness = {
  finikApiKey?: string | null | undefined;
  finikAccountId?: string | null | undefined;
  finikSecret?: string | null | undefined;
};

function hasApiKey(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function hasAccountId(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function hasSecret(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function envTrim(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function isOfficialPrivateKeyConfigured(): boolean {
  if (envTrim("FINIK_RSA_PRIVATE_KEY") !== "") return true;
  if (envTrim("FINIK_PRIVATE_KEY") !== "") return true;
  return envTrim("FINIK_RSA_PRIVATE_KEY_PATH") !== "";
}

/** Platform ENV ready for official RSA merchant storefront. */
export function isPlatformFinikEnvReady(): boolean {
  if (process.env.FINIK_USE_MOCK === "1" || process.env.FINIK_USE_MOCK === "true") {
    return true;
  }
  const apiKey = envTrim("PLATFORM_FINIK_API_KEY") || envTrim("FINIK_API_KEY");
  const accountId =
    envTrim("PLATFORM_FINIK_ACCOUNT_ID") || envTrim("FINIK_ACCOUNT_ID");
  return (
    apiKey !== "" &&
    accountId !== "" &&
    isOfficialPrivateKeyConfigured() &&
    envTrim("FINIK_PUBLIC_KEY") !== ""
  );
}

/** Feature flag: merchants need only finikAccountId; platform ENV holds secrets. */
export function isFinikPlatformManagedMerchantsEnabled(): boolean {
  const v = process.env.FINIK_PLATFORM_MANAGED_MERCHANTS?.trim();
  return v === "1" || v === "true" || v === "on";
}

export function resolveMerchantFinikMode(
  business: MerchantFinikBusiness,
): MerchantFinikMode {
  if (hasApiKey(business.finikApiKey) && hasSecret(business.finikSecret)) {
    return "legacy_merchant_keys";
  }
  if (isFinikPlatformManagedMerchantsEnabled()) {
    return "platform_managed";
  }
  return "legacy_merchant_keys";
}

export function isMerchantFinikPlatformManaged(
  business: MerchantFinikBusiness,
): boolean {
  return resolveMerchantFinikMode(business) === "platform_managed";
}

/** Merchant can accept Finik checkout under platform-managed model. */
export function isMerchantFinikCheckoutReady(
  business: MerchantFinikBusiness,
): boolean {
  const mode = resolveMerchantFinikMode(business);
  if (mode === "platform_managed") {
    if (!isFinikPlatformManagedMerchantsEnabled()) {
      return false;
    }
    return hasAccountId(business.finikAccountId) && isPlatformFinikEnvReady();
  }
  return hasApiKey(business.finikApiKey) && hasAccountId(business.finikAccountId);
}
