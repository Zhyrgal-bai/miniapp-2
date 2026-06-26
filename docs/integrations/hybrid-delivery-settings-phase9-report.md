# Phase 9 — Merchant Delivery Settings UI Migration Report

## Summary

Replaced legacy five-mode delivery pricing UI in the platform merchant settings modal with a **hybrid provider model**: Yandex Delivery (live API) + Merchant Delivery (regional fixed prices). Checkout flow remains **Yandex quote → merchant fallback → unavailable**.

## UI changes

| Removed (legacy) | Replacement |
|------------------|-------------|
| Только самовывоз | Самовывоз toggle in Merchant Delivery section |
| Фиксированная доставка | Region with fixed price |
| По расстоянию | Regions (migrated from tiers) |
| Бесплатная доставка | Region with `priceSom: 0` |
| Рассчитывает менеджер | Region note / manual flag |
| Distance tier editor | Region list (name, price, notes) |
| Zone km/ETA editor in delivery panel | Schedule in «График»; Yandex limits only |

**Deleted obsolete components:**
- `frontend/src/components/platform/MerchantDeliverySettingsPanel.tsx`
- `frontend/src/components/platform/MerchantStoreAvailabilityPanel.tsx`
- `frontend/src/components/platform/MerchantStoreAvailabilityPanel.css`

**Rewritten:**
- `frontend/src/components/platform/merchantSettings/panels/MerchantSettingsDeliveryPanel.tsx`

## Data model

### `MerchantDeliverySettings` (extended, backward compatible)

| Field | Purpose |
|-------|---------|
| `pricingMode` | New canonical: `REGION_BASED`; legacy modes still parsed |
| `regions[]` | `{ id, name, priceSom, notes? }` |
| `merchantDeliveryEnabled` | Merchant fallback on/off |
| `distanceTiers`, `fixedPriceSom` | Legacy — preserved for read/migration |

### `providerPolicy` (in `deliverySettings` JSON)

Yandex UI maps to existing `MerchantDeliveryProviderPolicy`:
- `enabled`, `maxPriceSom`, `maxEtaMinutes`, `allowFallback`

### Auto-migration (`migrateMerchantDeliverySettings`)

| Legacy `pricingMode` | Migrated to |
|----------------------|-------------|
| `SELF_PICKUP` | `REGION_BASED`, `merchantDeliveryEnabled: false` |
| `FIXED_PRICE` | Single region «Доставка» at `fixedPriceSom` |
| `FREE_DELIVERY` | Single region at 0 сом |
| `MANUAL_CONFIRMATION` | Single region with manual note |
| `DISTANCE_BASED` | Regions from tiers («До N км» / «Дальше») |

Migration runs on **every** `parseMerchantDeliverySettings()` (load + save validation).

## Checkout (unchanged flow, additive field)

1. **Yandex** — `HybridCheckoutDeliveryResolver` → `DeliveryEngine`
2. **Merchant** — `resolveMerchantDeliveryFallback` → `computeDeliveryQuote` with `REGION_BASED`
3. Region match: customer `destinationLabel` (address from checkout) + fallback for migrated km-tier names

Optional request field: `destinationLabel` on `POST /api/delivery/checkout-quote`.

## Backend compatibility

- Legacy `pricingMode` values still parse and migrate; no DB migration required
- `platformMerchantStoreSettings` now **merges** `providerPolicy` when saving delivery settings (fixes prior wipe bug)
- Storefront wire schema extended with `REGION_BASED`, optional `regions`, `merchantDeliveryEnabled`
- `DeliveryProviderSettings` (admin `#/admin/delivery` → Провайдеры) unchanged for ops; merchant bot uses new panel

## Tests added/updated

- `tests/smoke/merchantDeliveryMigration.test.ts`
- `tests/smoke/merchantDeliverySettings.test.ts` — default `REGION_BASED`

## Files touched (core)

| Layer | Files |
|-------|--------|
| Shared | `merchantDeliverySettings.ts`, `merchantDeliveryMigration.ts`, `hybridDeliveryCheckout.ts` |
| Server | `merchantDeliveryFallback.ts`, `hybridCheckoutDeliveryResolver.ts`, `deliveryCheckoutQuoteRoute.ts`, `platformMerchantStoreSettings.ts` |
| Frontend | `MerchantSettingsDeliveryPanel.tsx`, `PlatformPage.tsx`, `MerchantSettingsModal.tsx`, `platformApi.ts`, `useCheckoutDeliveryQuote.ts`, `CheckoutPage.tsx` |
| Schema | `storefrontPublicApiResponseSchema.ts` |

## Post-deploy verification

1. Platform → Настройки → Доставка: two provider cards visible
2. Save regions + Yandex limits → reload → values persist; `providerPolicy` not wiped
3. Checkout with address containing «Бишкек» → merchant fallback price 150 (if Yandex unavailable)
4. Legacy merchant with `DISTANCE_BASED` in DB → auto-migrates on first load/save
