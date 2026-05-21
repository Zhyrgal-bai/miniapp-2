# Production QA Checklist

Manual QA runbook before production launch. Run on **real devices** (iPhone, Android, Telegram Desktop) against **staging** with production-like env vars.

## 1. Real device testing

| Device | Pass | Notes |
|--------|------|-------|
| iPhone Telegram Mini App | ☐ | Touch, scroll, drawers, sheets |
| Android Telegram Mini App | ☐ | Keyboard overlap, safe areas |
| Telegram Desktop | ☐ | WebView sizing, mouse vs touch |
| Slow / low-memory device | ☐ | Large catalog, long order list |

**Focus:** product detail sheet sticky CTA, checkout footer, support composer, cart drawer.

## 2. Telegram lifecycle

| Scenario | Pass | Notes |
|----------|------|-------|
| App reopen after background | ☐ | Admin gate refreshes, payment poll resumes |
| Interrupted Finik payment | ☐ | Overlay clears; banner shows retry |
| Lost connection mid-checkout | ☐ | Network error + retry button |
| App reload / WebView restore | ☐ | Tenant slug/`?shop=` preserved |
| Deep link / slug routing | ☐ | Correct storefront loads |
| Telegram BackButton | ☐ | Navigates in-app, not closes Mini App |

## 3. Checkout stress

| Scenario | Pass | Notes |
|----------|------|-------|
| Rapid double submit | ☐ | Second request 429 or idempotent |
| Failed / cancelled Finik | ☐ | Order CANCELLED, stock released |
| Closed Finik window | ☐ | Banner retry works |
| Duplicate webhook | ☐ | No double inventory commit |
| Stale pending orders | ☐ | Cleanup after TTL (default 6h) |

## 4. Inventory race

| Scenario | Pass | Notes |
|----------|------|-------|
| Last item — two users | ☐ | One succeeds, one gets stock error |
| Refund restore | ☐ | `available` increases |
| Return restore (RETURNED → REFUNDED) | ☐ | shipped → returned → available |
| Support cancel before pay | ☐ | reserved → available |

**Automated:** `DATABASE_URL=... npm run test:integration`

## 5. Support flow

| Scenario | Pass | Notes |
|----------|------|-------|
| Cancel before payment | ☐ | |
| Refund after payment | ☐ | |
| Return after delivery | ☐ | |
| Attachments upload | ☐ | |
| Unread / timeline consistency | ☐ | |

## 6. Staff + permissions

| Role | Pass | Hidden sections |
|------|------|-----------------|
| OWNER | ☐ | Full access |
| ADMIN | ☐ | All except team if not owner |
| MANAGER | ☐ | No settings-only surfaces |
| SUPPORT | ☐ | Support only; no orders/products |
| Customer | ☐ | Never sees admin UI |

## 7. Vertical flows

Test full path (catalog → cart → checkout → pay → admin order) for:

- ☐ clothing (size + color)
- ☐ coffee (volume / hot-cold)
- ☐ flowers (delivery date / options)
- ☐ fastfood (addons / combo)

## 8. Mobile UX

- ☐ One-hand reach for primary CTAs
- ☐ Sticky checkout/cart footer above safe area
- ☐ Long lists scroll smoothly
- ☐ Modals/sheets dismiss without scroll lock stuck

## 9. Error recovery

| Failure | Expected UI |
|---------|-------------|
| API timeout (30s) | Network message + retry |
| Invalid stock at checkout | Clear error, cart intact |
| Webhook reject | Order stays pending; logs `webhook_reject` |
| Stale session / 401 admin | Re-auth via initData |

## 10. Performance

- ☐ 100+ products catalog scroll
- ☐ 50+ orders in admin
- ☐ Image-heavy storefront on 3G throttle

## 11. Production logs (JSON)

Verify in server logs during QA:

- `inventory_mismatch`
- `inventory_reserve_failed`
- `payment_failure`
- `webhook_processed` / `webhook_reject`
- `auth_reject`
- `checkout_reject`
- `stale_order_released`

## 12. Pre-deploy env

- `FINIK_WEBHOOK_SIGNATURE_HEADER` set
- `BOT_TOKEN_SECRET_KEY` set
- `SKIP_TELEGRAM_WEBAPP_AUTH` **unset** in production
- Mini App sends `x-telegram-init-data` on admin/checkout

## Commands

```bash
npm run check
npm run test:smoke
DATABASE_URL=... npm run test:integration
```

## Sign-off

| Area | Owner | Date | Status |
|------|-------|------|--------|
| Mobile QA | | | |
| Payments | | | |
| Inventory | | | |
| Staff/Auth | | | |
| Support | | | |
