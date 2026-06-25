# Yandex Delivery — Phase 3 Report

Automatic delivery creation after Finik payment confirmation: provider-agnostic fulfillment orchestration, Yandex claims create/accept, in-memory offer cache bridge, and `ProviderDelivery` persistence.

## Architecture

```mermaid
sequenceDiagram
  participant Client as Storefront
  participant Calc as POST_calculate
  participant Cache as deliveryOfferCache
  participant Checkout as Checkout
  participant Finik as FinikWebhook
  participant Fulfill as deliveryFulfillmentService
  participant Provider as YandexDeliveryProvider
  participant Create as YandexClaimsCreateService
  participant Accept as YandexClaimsAcceptService
  participant DB as ProviderDelivery

  Client->>Calc: destination coords
  Calc->>Cache: store payload by providerOfferId
  Calc-->>Client: providerOfferId (no payload)
  Client->>Checkout: deliveryOfferId opaque
  Checkout->>DB: Order with deliveryOfferId
  Finik->>Fulfill: onOrderPaidConfirmed
  Fulfill->>DB: ProviderDelivery NEW
  Fulfill->>Provider: createAndAccept
  Provider->>Create: claims/create
  Provider->>Accept: claims/accept
  Provider-->>Fulfill: claimId ACCEPTED
  Fulfill->>DB: CREATED → ACCEPTED → SEARCHING_COURIER
```

## Delivery lifecycle (ProviderDelivery)

```
NEW → CREATED → ACCEPTED → SEARCHING_COURIER
  └──────────────────────────────→ FAILED
```

| Status | Meaning |
|--------|---------|
| `NEW` | Record created before provider call |
| `CREATED` | Yandex claim created |
| `ACCEPTED` | Claim accepted |
| `SEARCHING_COURIER` | Fulfillment complete (MVP terminal success) |
| `FAILED` | Offer missing, validation, or provider error — order stays `CONFIRMED` |

## Trigger conditions

All must be true:

1. `YANDEX_DELIVERY_CLAIMS_ENABLED=1`
2. `order.deliveryMode === DELIVERY`
3. `order.deliveryOfferId` present
4. `order.status === CONFIRMED` (after Finik payment)

Hook: `onOrderPaidConfirmed` → non-blocking `fulfillDeliveryForPaidOrder`.

## Files created

| File | Role |
|------|------|
| `prisma/migrations/20260703120000_provider_delivery_phase3/` | Schema migration |
| `src/server/delivery/types/providerDeliveryTypes.ts` | Domain types |
| `src/server/delivery/repositories/providerDeliveryRepository.ts` | Persistence port |
| `src/server/delivery/services/deliveryOfferCache.ts` | In-memory offer TTL cache |
| `src/server/delivery/services/deliveryFulfillmentService.ts` | Post-payment orchestrator |
| `src/server/delivery/providers/deliveryProviderPort.ts` | Provider abstraction |
| `src/server/delivery/providers/deliveryProviderRegistry.ts` | Provider lookup |
| `src/server/delivery/providers/yandex/yandexDeliveryProvider.ts` | Yandex create+accept |
| `src/server/delivery/providers/yandex/dto/yandexClaimsDto.ts` | Wire DTOs |
| `src/server/delivery/providers/yandex/adapters/yandexClaimsAdapter.ts` | Request/response mapping |
| `src/server/delivery/providers/yandex/services/YandexClaimsCreateService.ts` | claims/create |
| `src/server/delivery/providers/yandex/services/YandexClaimsAcceptService.ts` | claims/accept |
| `src/server/delivery/providers/yandex/utils/yandexClaimsLogging.ts` | Structured logs |
| `tests/smoke/yandexClaimsCreateService.test.ts` | Claims create unit tests |
| `tests/smoke/deliveryFulfillmentService.test.ts` | Fulfillment unit tests |

## Files modified (additive)

| File | Change |
|------|--------|
| `prisma/schema.prisma` | `Order.deliveryOfferId`, `ProviderDelivery` model |
| `yandexDeliveryConfig.ts` | Claims paths, flags, offer cache TTL |
| `YandexDeliveryPriceService.ts` | `deliveryOfferCache.put` after best offer |
| `orderInventoryHooks.ts` | Fulfillment hook on paid confirm |
| `index.ts` | Checkout `deliveryOfferId` field |
| `checkoutOrderWrite.ts` | `parseCheckoutDeliveryOfferId` |
| `.env.example` | Phase 3 env vars |

**Not modified:** `deliveryQuoteService.ts`, Phase 1 HTTP client core, public calculate API shape.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `YANDEX_DELIVERY_CLAIMS_ENABLED` | off | Gate auto-fulfillment |
| `YANDEX_DELIVERY_CLAIMS_CREATE_PATH` | `/b2b/cargo/integration/v2/claims/create` | Create endpoint |
| `YANDEX_DELIVERY_CLAIMS_ACCEPT_PATH` | `/b2b/cargo/integration/v2/claims/accept` | Accept endpoint |
| `YANDEX_DELIVERY_OFFER_CACHE_TTL_MS` | `1800000` (30 min) | Offer cache TTL |
| `YANDEX_DELIVERY_USE_MOCK` | off | Mock claims without HTTP |
| `YANDEX_DELIVERY_OAUTH_TOKEN` | — | Bearer token (Phase 1) |

## Risks

1. **Ephemeral offer cache** — server restart loses payloads; Phase 4 should use Redis or DB snapshot.
2. **Single-instance cache** — multi-instance deploy needs shared store.
3. **Fee mismatch** — checkout `deliveryFee` may differ from Yandex quote until Phase 4 aligns pricing.
4. **Russia-only API** — KG routes may fail (same as Phase 2).
5. **No payment rollback** — provider failure leaves order paid; ops must handle `FAILED` deliveries manually.

## Phase 4 prep

- Yandex claim status webhooks and courier tracking
- Checkout fee alignment with `/api/delivery/calculate`
- Persistent offer store (Redis)
- Cancel / retry flows
- Frontend delivery offer selection UI

## Verification

```bash
npx prisma generate
npm test
npm run build
```

Manual (mock): checkout with `deliveryOfferId` → Finik webhook → `ProviderDelivery.status = SEARCHING_COURIER`.
