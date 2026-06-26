# Phase 9.2 — Region-Based Checkout Delivery Routing

## Problem

Phase 8.5 treated Merchant Delivery as a **fallback** when Yandex failed. That is incorrect for the product model:

- **Bishkek** must always use **Yandex Delivery** (live quote).
- **Outside Bishkek** must use **Merchant regional pricing** only.
- Merchant Delivery is **not** a generic fallback provider.

## New routing logic

```
Checkout quote request
        │
        ▼
  Pickup? ──yes──► 0 сом, no providers
        │ no
        ▼
  Destination = Bishkek?
  (city / parsed label / legacy substring)
        │
   yes ─┴─ no
    │       │
    ▼       ▼
 Yandex   REGION_BASED?
 only     │
    │     ├─ match merchant region (excl. Бишкек) ──► Merchant fixed price
    │     ├─ no region match ──► DELIVERY_UNAVAILABLE
    │     └─ legacy mode (FIXED/DISTANCE/…) ──► Merchant pricing
    │
 fail ──► DELIVERY_UNAVAILABLE
 (no merchant fallback)
```

### Priority table

| Destination | Provider | Yandex called? | Merchant pricing? |
|-------------|----------|----------------|-------------------|
| Бишкек | Yandex | Yes | **Never** |
| Configured region (Токмок, Каракол, Иссык-Куль, …) | Merchant | **No** | Yes (region price) |
| Unknown / unconfigured | — | **No** | No → unavailable |
| Legacy non–region-based settings (non-Bishkek) | Merchant | **No** | Yes (legacy rules) |

### Bishkek detection

`isBishkekDestination()` in `src/shared/checkoutDeliveryRouting.ts`:

1. `destinationLocality.city` → normalized `бишкек` / `bishkek`
2. `parseCityFromDisplayAddress(destinationLabel)`
3. Legacy label substring (`бишкек`, `bishkek`) for old clients

### Merchant region match

Uses Phase 9.1 resolver (`resolveMerchantDeliveryRegionWithMeta`) on regions **excluding** «Бишкек».  
Structured fields: `city` → `district` → `region` → `country`, then deprecated label, then distance tiers.

## API / checkout (unchanged UX)

- Same `POST /api/delivery/checkout-quote` body
- `destinationLocality` + `destinationLabel` still sent from checkout
- Response field `fallbackUsed` is now **`false`** for merchant regional quotes (no fallback semantics)

## Backward compatibility

| Case | Behavior |
|------|----------|
| Old client: only `destinationLabel` «Бишкек, …» | Routes to Yandex |
| Old client: only label «Токмок, …» | Merchant regional |
| Yandex failure in Bishkek | Explicit `DELIVERY_UNAVAILABLE` (was merchant fallback) |
| Legacy `FIXED_PRICE` / `DISTANCE_BASED` (raw DB mode) outside Bishkek | Merchant route via `legacy_merchant` (no region name required) |
| Metric `checkout_delivery_merchant_fallback_total` | Still incremented for merchant route (dashboard compat) |

## Files

| File | Change |
|------|--------|
| `src/shared/checkoutDeliveryRouting.ts` | **New** — route resolver |
| `src/shared/merchantDeliveryLocality.ts` | `isBishkekCityName()` |
| `src/server/delivery/engine/hybridCheckoutDeliveryResolver.ts` | Route-first, no merchant fallback |
| `src/server/delivery/engine/merchantDeliveryFallback.ts` | `fallbackUsed: false` |
| `src/shared/merchantDeliverySettings.ts` | Block Bishkek region on merchant quote |
| `tests/smoke/checkoutDeliveryRouting.test.ts` | **New** |
| `tests/smoke/hybridCheckoutDelivery.test.ts` | Updated scenarios |

## Verification

```bash
npx vitest run tests/smoke/checkoutDeliveryRouting.test.ts
npx vitest run tests/smoke/hybridCheckoutDelivery.test.ts
npx vitest run tests/smoke/merchantDeliveryLocality.test.ts
```

**Expected:**

- `city: "Бишкек"` → Yandex only; tariff failure → unavailable
- `city: "Токмок"` → 300 сом merchant; Yandex `calculatePrice` not invoked
- `city: "Ош"` (not configured) → unavailable
