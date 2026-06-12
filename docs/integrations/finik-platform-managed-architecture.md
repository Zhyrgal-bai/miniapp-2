# Finik Platform-Managed Integration

> ARCHA holds platform Finik secrets; merchants provide **Account ID only**.

## Platform ENV (server-only)

| Variable | Purpose |
|----------|---------|
| `FINIK_API_KEY` | All API calls |
| `FINIK_PRIVATE_KEY` | RSA sign create/status |
| `FINIK_PUBLIC_KEY` | Webhook verify |
| `FINIK_OFFICIAL_ACQUIRING_BASE_URL` / `FINIK_API_URL` | API host |
| `FINIK_ACCOUNT_ID` | **Subscription recipient only** |
| `FINIK_PLATFORM_MANAGED_MERCHANTS` | `1` = new model for merchants without legacy keys |

## Merchant DB

| Field | New merchants | Legacy (grandfather) |
|-------|---------------|----------------------|
| `finikAccountId` | Required for payments | Keep |
| `finikApiKey` | Not used | Used with `finikSecret` |
| `finikSecret` | Not used | Legacy HTTP + HMAC webhook |

## Flow separation

**Subscription:** `FINIK_ACCOUNT_ID` (platform) → `POST /api/payments/create` → webhook `/api/platform/subscription-finik-webhook`

**Storefront:** `business.finikAccountId` (merchant) → checkout → platform signs with ENV keys → webhook `/finik/webhook/:businessId`

Money for storefront orders goes to merchant Finik account; subscription money goes to ARCHA platform account.

## Mode resolution

```
if FINIK_PLATFORM_MANAGED_MERCHANTS && !(finikApiKey && finikSecret) → platform_managed
if finikApiKey && finikSecret → legacy_merchant_keys
else → platform_managed (when flag on) or legacy readiness rules (flag off)
```

## Code map

| Module | Role |
|--------|------|
| `src/server/finik/resolveFinikTenantCredentials.ts` | Mode + platform credential policy |
| `src/shared/finikReady.ts` | Checkout readiness gates |
| `src/server/finik/officialAcquiringCreateAdapter.ts` | Platform-first API key for managed merchants |
| `src/server/finik/finikWebhookVerify.ts` | RSA-first for managed merchants |
| `src/server/platformMerchantStoreSettings.ts` | Account ID only save |

See also [finik-acquiring.md](./finik-acquiring.md).
