# Platform Analytics — Operating Plan

> **Shift:** Analytics serve **merchants** AND **platform operators/founders** — data-driven operating mode.

---

## 1. Current state

| Data | Storage | Operator access |
|------|---------|-----------------|
| Onboarding funnel | `PlatformFunnelEvent` | `GET /api/platform/admin/funnel/summary` |
| Beta feedback | `ProductFeedback` | Admin feedback list |
| Storefront behavior | `StorefrontEvent` | Per-merchant analytics |
| Orders / GMV | `Order` | Per-merchant + manual |
| Growth score | Computed | Admin «Рост» tab |
| Retention nudges | `merchantRetentionService` | Notifications |

**Gap:** No platform-level **churn**, **cohort retention**, **checkout failure**, or **feature adoption** dashboards.

---

## 2. Platform metrics framework

### North star metrics

| Metric | Definition |
|--------|------------|
| **Active merchants** | Order OR publish in last 30d |
| **Network GMV** | Sum paid/done orders 30d |
| **Merchant 60d retention** | % approved merchants still active at day 60 |
| **Time to first order** | Approve → first `Order` median |

### Supporting metrics

| Category | Metrics |
|----------|---------|
| Onboarding | Funnel step conversion, readiness score distribution |
| Retention | 30/60/90d cohorts, at_risk count |
| Checkout | `CHECKOUT_START` → `ORDER_CREATED` rate, payment fail |
| Support | Tickets/merchant/month, time to first reply |
| Discover | Impressions, clicks, opt-in listing rate |
| Features | Referral usage, public listing %, growth tab views |
| Infra | API p95, 5xx rate, webhook fail count |

---

## 3. Metrics → data source map

| Metric | Source today | Build needed |
|--------|--------------|--------------|
| Funnel conversion | `PlatformFunnelEvent` | ✅ |
| Onboarding completion | Funnel + readiness | Dashboard combine |
| Merchant churn | None | **Cohort job** |
| 60d retention | None | **Cohort job** |
| Failed checkout | `StorefrontEvent` types | Aggregate query |
| Support overload | Support tickets | Count by week |
| Feature adoption | Mixed | Event taxonomy |
| Referral adoption | `MerchantReferralSignup` | ✅ |

---

## 4. Phase 1 — Platform ops dashboard (minimum)

**Endpoint:** `GET /api/platform/admin/metrics/overview?days=30`

**Payload (target):**

```typescript
{
  activeMerchants: number;
  newApprovals: number;
  churnedMerchants: number;      // no activity 30d after prior activity
  ordersInPeriod: number;
  gmvSom: number;
  funnel: { step: string; count: number }[];
  checkoutConversion: number | null;
  publicListingRate: number;     // public / published
  openFeedback: number;
  atRiskMerchants: number;
}
```

**UI:** Operator section on admin or dedicated `/platform-admin/metrics` — read-only.

---

## 5. Phase 2 — Cohort retention

```prisma
model MerchantActivityDaily {
  day        DateTime @db.Date
  businessId Int
  hadOrder   Boolean  @default(false)
  hadEvent   Boolean  @default(false)
  @@id([day, businessId])
}
```

**Job:** Nightly rollup from orders + `StorefrontEvent`.

**Output:** Cohort table: approval week → % active week 4, 8, 12.

---

## 6. Event taxonomy additions

| Event | When |
|-------|------|
| `CHECKOUT_FAILED` | Payment error surfaced |
| `DISCOVER_IMPRESSION` | Discover card visible |
| `DISCOVER_CLICK` | Open store from discover |
| `FEATURE_ADOPTION.*` | e.g. referral copy, listing toggle |

---

## 7. Analytics operating rhythm

| Cadence | Review |
|---------|--------|
| Weekly (Mon) | Funnel + feedback + at-risk count |
| Monthly | Retention cohort, GMV, listing adoption |
| Quarterly | North star vs targets; roadmap input |

**Owner:** Operator pulls weekly; founder reviews monthly.

---

## 8. Privacy & governance

| Rule | Detail |
|------|--------|
| Platform dashboard | Aggregated only — no buyer PII |
| Merchant analytics | Tenant-scoped |
| Retention | Business-level, not individual buyers |
| Export | Operator-only; log access |

---

## Related docs

- [Product Operating Model](../product-operating-model.md)
- [Operations Platform Architecture](../operations-platform-architecture.md)
- [Release Preparation Validation](../release-preparation-validation.md)
