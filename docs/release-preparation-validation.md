# Real Users + Release Preparation + Product Validation

> **Mindset shift:** Stop endless building → **real people use the product**.  
> **Goal:** Usable, stable, measurable release — not more systems.

---

## Executive summary

The platform is **functionally large enough for beta**. This phase validates adoption, stabilizes real flows, and prepares production release — **without new giant features**.

| Pillar | Status today | This phase |
|--------|--------------|------------|
| Deploy | Render + Vercel, `productionStart.mjs` | Health checks, env validation, checklist |
| Onboarding | PlatformPage wizard + registration | Funnel analytics |
| Merchant success | Growth score in admin + platform | Readiness on `/merchant` |
| Feedback | None | Beta feedback API + UI |
| Observability | console.log | Client errors + operator funnel API |
| Documentation | Architecture docs | Merchant + operator guides |

---

## 1. Release preparation

### Production stack

| Component | Host | Config |
|-----------|------|--------|
| API + bots | Render | `render.yaml`, `scripts/productionStart.mjs` |
| SPA | Vercel | `frontend/vercel.json`, `VITE_API_URL` |
| Database | Render Postgres | `DATABASE_URL` + `sslmode=require` |

### Implemented (Phase 1)

| Item | Path |
|------|------|
| Env validation (fail fast prod) | `src/server/envValidation.ts` |
| Liveness | `GET /health` |
| Readiness (DB ping) | `GET /ready` |
| Render health check | `render.yaml` → `/health` |
| Release checklist | `docs/release-checklist.md` |

### Still required (Phase 2)

- [ ] Sentry DSN (`SENTRY_DSN`) — frontend + backend
- [ ] Automated DB backup verification (Render dashboard)
- [ ] Rollback runbook (redeploy previous commit + migrate status check)
- [ ] Staging environment mirror
- [ ] Disable `TELEGRAM_INIT_DEBUG=1` on production

### Environment validation rules

**Production FATAL (exit):**
- `SKIP_TELEGRAM_WEBAPP_AUTH=1`
- Missing `BOT_TOKEN_SECRET_KEY`
- Missing `TELEGRAM_WEBHOOK_SECRET`
- Missing `DATABASE_URL`

**Production WARN:**
- Missing `FINIK_WEBHOOK_SIGNATURE_HEADER`
- Missing `OPERATOR_PASSWORD_HASH`
- Missing `FRONT_URL`

---

## 2. Real merchant onboarding testing

### Funnel steps (instrumented)

| Step | Trigger | Source |
|------|---------|--------|
| `platform_view` | Open `/merchant` | PlatformPage mount |
| `onboarding_step_1/2/3` | Wizard steps | PlatformPage |
| `onboarding_complete` | Dismiss wizard | PlatformPage |
| `register_start` | Open register form | MerchantRegisterPage |
| `register_submit` | Successful application | MerchantRegisterPage |
| `store_open` | Open storefront | PlatformPage |

**Storage:** `PlatformFunnelEvent` table  
**Operator API:** `GET /api/platform/admin/funnel/summary?days=30`

### Manual test protocol (beta merchants)

1. Fresh Telegram account → `/merchant` → complete onboarding wizard
2. Submit registration → wait operator approve
3. Configure Finik → add 3+ products → publish storefront
4. Place test order from second account
5. Respond in support

**Record:** time per step, drop-off step, confusion notes in feedback form.

### Abandonment signals (automatic)

| Signal | Interpretation |
|--------|----------------|
| `register_start` without `register_submit` | Form friction |
| `platform_view` without `store_open` in 7d | Onboarding failure |
| Low readiness score + no `first_order` | Setup incomplete |

---

## 3. Storefront usability testing

### Test script (shopper)

| # | Task | Pass criteria |
|---|------|---------------|
| 1 | Open store via `/s/:slug` | Catalog loads < 3s |
| 2 | Browse categories | Sticky nav works |
| 3 | Open product sheet | Images, price, add to cart |
| 4 | Checkout | Phone validation, address |
| 5 | Finik payment | Return + order visible in My Orders |
| 6 | Support ticket | Message delivered to merchant |

**Devices:** iOS Telegram, Android Telegram, Telegram Desktop (minimum).

**Already tracked:** `StorefrontEvent` (STORE_VIEW, PRODUCT_VIEW, ADD_TO_CART, CHECKOUT_START).

---

## 4. Merchant usability testing

### Test script (merchant)

| # | Task | Pass criteria |
|---|------|---------------|
| 1 | Platform dashboard | Stores listed, readiness visible |
| 2 | Admin products | Add/edit product |
| 3 | Admin design | Publish storefront |
| 4 | Admin orders | Change status |
| 5 | Operations tab | Analytics loads |
| 6 | Support | Reply with quick suggestions |

---

## 5. Performance under real usage

### Load test targets (before public beta)

| Scenario | Target | Tool |
|----------|--------|------|
| 50 concurrent storefront views | p95 < 1s | k6 / artillery |
| 10 merchants loading analytics | p95 < 3s | Manual + logs |
| 100 funnel events/min | No errors | Synthetic POST |
| Webhook burst | No 5xx | Telegram replay |

### Known scaling limits (document, don't fix yet)

- Analytics loads all orders in range — OK for beta < 50 merchants
- Co-purchase SQL — OK for small catalogs
- In-memory storefront cache — single instance only

---

## 6. Production observability

### Phase 1 (shipped)

| Signal | Mechanism |
|--------|-----------|
| Client JS errors | `POST /api/telemetry/client-error` → structured warn log |
| Onboarding funnel | `PlatformFunnelEvent` + admin summary |
| Beta feedback | `ProductFeedback` + admin list |
| Health | `/health`, `/ready` |

### Phase 2 (recommended)

| Alert | Trigger |
|-------|---------|
| API down | Render health check fail |
| DB unreachable | `/ready` 503 |
| Payment failures | Finik webhook error rate |
| Webhook failures | Telegram setWebhook errors in logs |
| 5xx spike | Sentry / log drain |

**Optional env:** `SENTRY_DSN`, `ALERT_TELEGRAM_CHAT_ID`

---

## 7. Final UX cleanup (feedback-driven)

**Process:** Collect feedback → triage weekly → fix P0/P1 only.

| Source | Triage |
|--------|--------|
| `ProductFeedback` | Operator reviews `/api/platform/admin/feedback` |
| Funnel drops | Operator funnel summary |
| Direct beta chat | Tag + link to feedback ID |

**No speculative UX rewrites** — only fixes validated by real users.

---

## 8. Documentation map

| Doc | Audience |
|-----|----------|
| `docs/guides/merchant-quickstart.md` | New merchants |
| `docs/guides/operator-runbook.md` | Platform operators |
| `docs/release-checklist.md` | Deploy |
| `docs/platform-maturity-hardening-audit.md` | Engineering |
| Architecture docs | Internal |

---

## 9. Merchant success layer

| Feature | Status |
|---------|--------|
| Growth / readiness score | `merchantGrowthService` |
| Platform readiness UI | `/merchant` dashboard |
| Admin insights tab | Operations → Инсайты |
| Onboarding checklist | Embedded in readiness |
| Recommendations | Top 3 incomplete items |

---

## 10. Beta program

### Cohort model (no schema required)

Use `Business.featureFlags` JSON:

```json
{ "betaCohort": "2026-q2", "betaNotes": "first 10 merchants" }
```

### Beta workflow

1. Operator approves registration → set `betaCohort` manually in DB or admin tool
2. Merchant uses product → funnel + feedback
3. Weekly: operator reviews funnel summary + feedback list
4. Bi-weekly: 15-min call with 2–3 merchants (qualitative)

### Bug reporting flow

1. In-app feedback form on `/merchant` (shipped)
2. Operator triages `ProductFeedback` status: `open` → `triaged` → `closed`
3. Critical bugs → fix before expanding beta

---

## 11. Product validation framework

### Metrics (4 weeks beta)

| Metric | Target |
|--------|--------|
| Registration → approved | < 48h operator SLA |
| Approved → first product | > 80% in 7 days |
| First product → published storefront | > 60% |
| Published → first order | > 30% in 14 days |
| Week-2 merchant retention | > 50% log in again |
| Support tickets / merchant | < 3 in first month |

### Feature usage audit

Track via existing events — **do not build new dashboards yet**:

| Question | Data source |
|----------|-------------|
| Analytics used? | Admin page loads (add funnel step later) |
| Support used? | Ticket count |
| Promo used? | Promo apply on orders |
| Discovery rails clicked? | PRODUCT_VIEW events |

### Kill / keep criteria

- **Keep:** Used by > 30% beta merchants
- **Improve:** Used but feedback mentions confusion
- **Defer:** < 10% usage after 4 weeks

---

## 12. Platform stabilization (explicit non-goals)

**Do NOT add during beta:**
- Marketplace / ecosystem discover UI
- New AI features
- Loyalty / points
- Multi-storefront
- Theme marketplace
- Large refactors

**DO fix:**
- P0 security (see maturity audit)
- Checkout/payment bugs
- Mobile blockers
- Data loss (cart persist — maturity Phase 2)

---

## 13. Release mindset

```
BUILD MODE                          RELEASE MODE
──────────                          ────────────
Add systems                         Fix real user pain
Architecture docs                   Funnel + feedback data
"Theoretically scalable"            "Works for Merchant X"
More admin tabs                     Fewer confused merchants
```

**Definition of done for beta exit:**
- 10+ merchants with published storefronts
- 50+ real orders processed
- 0 open P0 bugs
- Security Phase 1 hardening complete
- Mobile QA P0 pass on iOS + Android

---

## 14. Phased roadmap

### Phase 0 — Strategy ✅ (this document)

### Phase 1 — Release infrastructure ✅

- [x] Env validation
- [x] `/health`, `/ready`
- [x] Funnel events + admin summary
- [x] Feedback API + platform UI
- [x] Store readiness on platform
- [x] Client error telemetry endpoint
- [x] Merchant + operator guides

### Phase 2 — Beta rollout (2–4 weeks)

- [ ] Recruit 5–10 beta merchants
- [ ] Run manual test scripts (§3–4)
- [ ] Weekly feedback triage
- [ ] Sentry integration
- [ ] Security hardening P0 (auth unify)

### Phase 3 — Stabilization from feedback

- [ ] UX fixes from top 10 feedback items
- [ ] Cart persist + Finik UX (maturity Phase 2)
- [ ] Remove raw IDs from customer UI
- [ ] Performance fixes if load test fails

### Phase 4 — Public release

- [ ] Release checklist sign-off
- [ ] Open registration or waitlist
- [ ] Marketing landing (optional)
- [ ] Post-release monitoring week

---

## 15. API reference (new endpoints)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | None | Liveness |
| GET | `/ready` | None | DB readiness |
| POST | `/api/platform/funnel/events` | initData | Ingest funnel |
| GET | `/api/platform/admin/funnel/summary` | Operator | Funnel counts |
| POST | `/api/platform/feedback` | initData | Beta feedback |
| GET | `/api/platform/admin/feedback` | Operator | List feedback |
| GET | `/api/platform/store-readiness` | initData + owner | Growth score |
| POST | `/api/telemetry/client-error` | Rate limited | Client errors |

**Deploy:** `npx prisma migrate deploy` for `20260621160000_release_validation_foundation`.

---

*Next: recruit beta merchants and run Phase 2 manual test scripts. Prioritize security hardening P0 before scaling beta cohort.*
