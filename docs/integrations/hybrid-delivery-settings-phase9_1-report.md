# Phase 9.1 — Structured Locality Region Matching

## Problem

Phase 9 matched merchant regions primarily via `destinationLabel` substring search. That is fragile for multi-tenant SaaS (false positives, ordering sensitivity, no structured geography).

## Solution

Introduced `DeliveryDestinationLocality` and a prioritized resolver in `src/shared/merchantDeliveryLocality.ts`.

## Resolution priority

| Priority | Mechanism | Match type |
|----------|-----------|------------|
| 1 | `destinationLocality.city` → `district` → `region` → `country` | **Exact** normalized token vs `region.name` |
| 2 | `parseCityFromDisplayAddress(destinationLabel)` | **Exact** city when structured city missing |
| 3 | `destinationLabel` substring | **Deprecated** fallback (Phase 9 behavior) |
| 4 | Distance tier labels (`До N км`) + radius cap | Legacy migration + `merchantDeliveryFallback` |

**Unchanged:** Haversine max-radius check in `merchantDeliveryFallback` runs **before** region pricing (Priority 4 validation).

## API

`POST /api/delivery/checkout-quote` accepts optional:

```json
{
  "destinationLocality": {
    "city": "Бишкек",
    "district": "…",
    "region": "…",
    "country": "Кыргызстан"
  },
  "destinationLabel": "…"
}
```

`destinationLabel` remains for backward compatibility and deprecated fallback only.

## Checkout (no UX change)

- Same address field, map, GPS, suggestions
- Client populates `destinationLocality` when:
  - Saved customer location has `city` / `country`
  - Nominatim reverse geocode (GPS / map)
  - Address suggestion includes Nominatim `address` object
  - Comma-parsed city from display text (`parseCityFromDisplayAddress`)
- Hook sends `destinationLocality` + `destinationLabel` on quote requests

## Backward compatibility

- Old clients sending only `destinationLabel` → still work via Priority 3
- Legacy `DISTANCE_BASED` tier region names → Priority 4 distance match
- No database migration

## Files

| File | Role |
|------|------|
| `src/shared/merchantDeliveryLocality.ts` | Types + resolver |
| `src/shared/merchantDeliverySettings.ts` | `computeDeliveryQuote` wires locality |
| `src/server/delivery/deliveryCheckoutQuoteRoute.ts` | Zod schema |
| `frontend/src/hooks/useCheckoutDeliveryQuote.ts` | Sends locality |
| `frontend/src/pages/CheckoutPage.tsx` | Collects locality silently |
| `tests/smoke/merchantDeliveryLocality.test.ts` | Priority tests |

## Verification

```bash
npx vitest run tests/smoke/merchantDeliveryLocality.test.ts
npx vitest run tests/smoke/merchantDeliveryMigration.test.ts
npx vitest run tests/smoke/hybridCheckoutDelivery.test.ts
```

Expected: structured `city: "Бишкек"` resolves to 150 сом without relying on substring match.
