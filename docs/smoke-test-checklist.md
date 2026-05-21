# Smoke test checklist (pre-deploy)

Automated: `npm run test:smoke` (Vitest, no DB required).

Integration (requires `DATABASE_URL`): run dev server + manual/API checks below.

## 1. Inventory

| Case | Auto | Manual |
|------|------|--------|
| Last item — second checkout fails 409 | ✅ simulator | Place 2 orders same SKU qty=1 |
| 2 clients simultaneous | ✅ race sim | Two devices, same product |
| Reserve on checkout | — | ProductStock.reserved += qty |
| Cancel restore | ✅ | Cancel before pay → available restored |
| Refund restore (CONFIRMED) | ✅ | Refund approved → paid→available |
| Refund restore (SHIPPED) | ✅ fixed | Refund on shipped order |
| Return restore | ✅ | RETURNED → RESTOCK |
| Stale unpaid (6h) | ✅ code | Abandon Finik → stock released on next checkout |

## 2. Finik

| Case | Auto | Manual |
|------|------|--------|
| Successful payment → CONFIRMED | ✅ state | Pay in Finik sandbox |
| Failed / cancelled | ✅ state | Cancel payment |
| Closed window | ✅ expired UI | Close Finik, wait poll timeout |
| Duplicate webhook | ✅ idempotent | Replay webhook twice |
| Retry payment | — | PaymentProcessingBanner retry button |

## 3. Order lifecycle

UX mapping (not DB enum rename):

| UX | DB status |
|----|-----------|
| PAYMENT_PENDING | NEW / ACCEPTED / PAID_PENDING |
| PAID | CONFIRMED |
| PROCESSING | CONFIRMED + delivery PREPARING |
| SHIPPED | SHIPPED |
| DELIVERED | DELIVERED |
| RETURNED | ReturnRequest flow |

## 4. Telegram Mini App UX (manual)

- [ ] iPhone: scroll catalog, checkout, support sheet
- [ ] Android: same + back button
- [ ] Drawers/sheets don't trap scroll (`useBodyScrollLock`)
- [ ] Checkout form keyboard overlap
- [ ] Support chat send + photo

## 5. Support flows (manual)

- [ ] Cancel before payment → merchant approve → order CANCELLED
- [ ] Refund after CONFIRMED → merchant REFUNDED
- [ ] Return after DELIVERED → RETURNED → RESTOCK

## 6. Stock consistency

- [ ] Save product variants → ProductStock rows match
- [ ] Remove variant → orphan row deleted (if no locked qty)
- [ ] attributes.variants sync with admin UI

## 7. Abuse protection

| Case | Expected |
|------|----------|
| Spam checkout (<30s) | 429 after **successful** order only |
| Failed checkout (stock) | No cooldown penalty |
| Duplicate cart (5 min) | 409 |
| Spam cancel/refund/return | 429 within 120s |

## Critical fixes in stabilization pass

1. Refund on SHIPPED now restores `shipped → available`
2. Cooldown only after successful checkout/support request
3. Orphan ProductStock cleanup on variant delete
4. Stale unpaid orders (6h) auto-release reservation
