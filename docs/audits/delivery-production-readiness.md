# Delivery Production Readiness

**Generated:** 2026-06-25T16:59:57.561Z  
**Overall status:** READY (automated checks)

Automated report from `node scripts/generate-delivery-production-readiness.mjs`. Re-run before each production deploy.

---

## Executive summary

| Scenario | Status | Evidence |
|----------|--------|----------|
| Merchant fixed delivery | **PASS** | E2E scenario 1 in deliveryFlowE2e.test.ts |
| Yandex live delivery + claim + webhook + recovery | **PASS** | E2E scenario 2 |
| Checkout / payment / dashboard / ops regression | **PASS** | E2E scenario 3 + smoke suite |

### Business rule reminder

**Merchant fallback (`deliveryProvider=merchant`)** — single Finik payment to merchant (`order.total` includes delivery fee). ARCHA does not hold merchant delivery fee. No `ProviderDelivery`, no provider claim, `deliveryOfferId=null`.

**Provider delivery (`deliveryProvider=yandex`, …)** — live offer, claim, `ProviderDelivery`, webhooks, recovery. Future split/payout applies only here.

---

## Passed checks

- Delivery E2E + regression suite (84 assertions across 16 files)
- Migration present: `prisma/migrations/20260703120000_provider_delivery_phase3`
- Migration present: `prisma/migrations/20260704120000_provider_delivery_tracking_phase4`
- Migration present: `prisma/migrations/20260705120000_provider_delivery_recovery_phase5`
- Migration present: `prisma/migrations/20260710120000_delivery_operations_phase6`
- Migration present: `prisma/migrations/20260711120000_hybrid_checkout_delivery_phase8_5`
- Prisma schema validates
- TypeScript production build (`npm run build`)

## Failed checks

_None_

## Warnings

- BOT_TOKEN / BOT_TOKENS not set — Telegram bots will not start
- FRONT_URL / MINI_APP_URL not set — Web App links may be broken
- Official Finik test credentials not configured (FINIK_PRIVATE_KEY, FINIK_PUBLIC_KEY, FINIK_API_KEY, FINIK_ACCOUNT_ID) — Official Acquiring smoke test disabled
- ENV (non-prod): DATABASE_URL is required

---

## E2E verification coverage

### Scenario 1 — Merchant fixed delivery

| Step | Verified |
|------|----------|
| Customer checkout quote via hybrid resolver | Merchant selected, `calculationSource=fixed` |
| `order.total` | Subtotal + fixed delivery fee |
| Finik payment session | Merchant tenant, full `order.total` amount |
| `deliveryOfferId` | `null` |
| `ProviderDelivery` | Not created |
| Fulfillment / Yandex claim | Not triggered |

### Scenario 2 — Yandex delivery

| Step | Verified |
|------|----------|
| Hybrid resolver | Live Yandex quote + `providerOfferId` |
| Post-payment fulfillment | `ProviderDelivery` + claim via engine |
| Webhook | `YandexWebhookService` refreshes tracking |
| Recovery | `deliveryRecoveryService` scans active deliveries |

### Scenario 3 — Regression

| Area | Verified via |
|------|----------------|
| Checkout helpers | `checkoutOrderWrite`, `checkoutErrorSurface` |
| Payment | `finikStorefrontCheckout` |
| Analytics | Hybrid checkout metrics counters |
| Dashboard | `deliveryMerchantDashboardService` |
| Timeline / ops | `deliveryOperationsPhase6`, `deliveryTrackingService` |
| Recovery | `deliveryRecoveryService` |

---

## Test run detail

| File | Status | Passed | Failed |
|------|--------|--------|--------|
| `tests\integration\deliveryFlowE2e.test.ts` | passed | 11 | 0 |
| `tests\smoke\checkoutErrorSurface.test.ts` | passed | 7 | 0 |
| `tests\smoke\checkoutOrderWrite.test.ts` | passed | 6 | 0 |
| `tests\smoke\deliveryEnginePhase7.test.ts` | passed | 8 | 0 |
| `tests\smoke\deliveryFulfillmentService.test.ts` | passed | 7 | 0 |
| `tests\smoke\deliveryHealthService.test.ts` | passed | 1 | 0 |
| `tests\smoke\deliveryMerchantDashboardService.test.ts` | passed | 1 | 0 |
| `tests\smoke\deliveryOperationsPhase6.test.ts` | passed | 8 | 0 |
| `tests\smoke\deliveryRecoveryService.test.ts` | passed | 4 | 0 |
| `tests\smoke\deliveryRefreshService.test.ts` | passed | 3 | 0 |
| `tests\smoke\deliveryStatusSyncService.test.ts` | passed | 2 | 0 |
| `tests\smoke\deliveryTrackingService.test.ts` | passed | 3 | 0 |
| `tests\smoke\finikStorefrontCheckout.test.ts` | passed | 4 | 0 |
| `tests\smoke\hybridCheckoutDelivery.test.ts` | passed | 8 | 0 |
| `tests\smoke\merchantDeliverySettings.test.ts` | passed | 6 | 0 |
| `tests\smoke\yandexWebhookService.test.ts` | passed | 5 | 0 |

---

## Required migrations

Apply with `npx prisma migrate deploy` before starting the server.

| Migration | Status | Notes |
|-----------|--------|-------|
| `prisma/migrations/20260703120000_provider_delivery_phase3` | required | Phase delivery schema |
| `prisma/migrations/20260704120000_provider_delivery_tracking_phase4` | required | Phase delivery schema |
| `prisma/migrations/20260705120000_provider_delivery_recovery_phase5` | required | Phase delivery schema |
| `prisma/migrations/20260710120000_delivery_operations_phase6` | required | Phase delivery schema |
| `prisma/migrations/20260711120000_hybrid_checkout_delivery_phase8_5` | required | Phase delivery schema |

---

## Required environment variables

| Variable | Required in prod | Purpose |
|----------|------------------|---------|
| `DATABASE_URL` | yes | all |
| `API_URL` | no | production webhooks |
| `RENDER_EXTERNAL_URL` | no | Render fallback for API_URL |
| `BOT_TOKEN_SECRET_KEY` | yes | production auth |
| `TELEGRAM_WEBHOOK_SECRET` | yes | production Telegram |
| `FINIK_WEBHOOK_SIGNATURE_HEADER` | no | Finik webhook verify |
| `YANDEX_DELIVERY_OAUTH_TOKEN` | yes | production live Yandex quotes |
| `YANDEX_DELIVERY_API_BASE` | no | Yandex API (default cargo host) |
| `YANDEX_DELIVERY_USE_MOCK` | no | dev only — forbidden in production |
| `FINIK_USE_MOCK` | no | dev only — forbidden in production |
| `DELIVERY_RECOVERY_MAX_ATTEMPTS` | no | recovery worker tuning |
| `DELIVERY_RECOVERY_RETRY_BASE_MS` | no | recovery worker tuning |
| `FRONT_URL` | no | storefront return URLs |
| `MINI_APP_URL` | no | Telegram Web App links |

**Production forbids:** `YANDEX_DELIVERY_USE_MOCK`, `FINIK_USE_MOCK`, `SKIP_TELEGRAM_WEBAPP_AUTH=1`, `TELEGRAM_INIT_DEBUG=1`, `WEBHOOK_DEBUG=1`.

**Per-merchant (database):** `Business.finikApiKey`, `finikAccountId`, `finikSecret` for storefront checkout payments.

---

## Deployment checklist

- [ ] `npx prisma migrate deploy` — all delivery migrations applied
- [ ] `npm run build` succeeds
- [ ] `npm run test:delivery-e2e` passes
- [ ] `node scripts/generate-delivery-production-readiness.mjs` — no failed checks
- [ ] `YANDEX_DELIVERY_OAUTH_TOKEN` set (live quotes)
- [ ] `API_URL` or `RENDER_EXTERNAL_URL` set (Finik + Yandex webhooks)
- [ ] Merchant Finik credentials configured for businesses accepting orders
- [ ] Verify hybrid checkout in staging: merchant zone + Yandex zone addresses
- [ ] Confirm merchant order: single Finik payment, no delivery ops row
- [ ] Confirm Yandex order: `ProviderDelivery` visible in merchant delivery dashboard

---

## Manual staging checks (not automated)

1. Place order with address outside Yandex but inside merchant tier → merchant fee, one payment.
2. Place order inside Yandex coverage → live fee, offer id on order, claim after payment.
3. Merchant delivery dashboard shows only provider deliveries (not merchant-owned).
4. Operations center search/export on a Yandex `ProviderDelivery` row.

---

## Regenerate

```bash
npm run test:delivery-e2e
node scripts/generate-delivery-production-readiness.mjs
```
