# Platform Monetization Strategy

> **Goal:** Sustainable revenue aligned with merchant success — not extractive SaaS.

---

## 1. Monetization philosophy

| Principle | Implication |
|-----------|-------------|
| **Align with GMV** | Higher plans unlock growth tools, not basic selling |
| **Network monetizes separately** | Discovery premium, featured placement (careful) |
| **Add-ons > plan bloat** | Themes, automation packs, analytics tiers as modules |
| **Free tier is real** | Enough to validate; upgrade when they grow |

**Anti-pattern:** Paywalling checkout, orders, or basic storefront publish.

---

## 2. Current billing state

| Element | Status |
|---------|--------|
| Trial + subscription | ✅ `subscriptionStatus`, trial dates |
| Finik SaaS payment | ✅ 30/90 day plans via PlatformPage |
| Hardcoded prices | ✅ `SAAS_SUBSCRIPTION_PRICE_*` in `saasBillingService.ts` |
| Plan field on Business | Partial — `billingPlan` mostly unset |
| Entitlement enforcement | ❌ Not wired |
| Add-on billing | ❌ Not built |
| Theme marketplace payments | ❌ Not built |

**Today:** Single subscription SKU (time-based). **Target:** Plan catalog + add-ons + usage gates.

---

## 3. Plan catalog (recommended)

### 3.1 Tiers

| Plan | Monthly (indicative) | Target merchant |
|------|----------------------|-----------------|
| **FREE** | 0 | Testing, first 25 products |
| **STARTER** | ~990 сом | Solo seller, stable orders |
| **GROWTH** | ~2490 сом | Team, campaigns, discover boost |
| **ENTERPRISE** | Custom | Multi-store, API, SLA |

*Prices are placeholders — validate with KG market.*

### 3.2 Entitlements matrix

| Capability | FREE | STARTER | GROWTH | ENTERPRISE |
|------------|------|---------|--------|------------|
| Products | 25 | 100 | 500 | ∞ |
| Staff | 1 | 3 | 10 | ∞ |
| Storefronts | 1 | 1 | 3 | ∞ |
| Automations | 0 | 3 | 20 | ∞ |
| Analytics range | 7d | 30d | 90d + export | Full |
| Discover listing | ✅ opt-in | ✅ | ✅ + category boost | Featured priority |
| Premium themes | 0 | 2 | All official | Custom + marketplace |
| Referral rewards | Basic link | Stats | Tiered rewards | Partner program |
| Support | Community | Email 48h | Priority 24h | Dedicated |
| API access | ❌ | ❌ | Read | Full |

### 3.3 Schema (Phase 2 foundation)

```prisma
enum BillingPlan {
  FREE
  STARTER
  GROWTH
  ENTERPRISE
}

model PlanEntitlement {
  plan     BillingPlan @id
  limits   Json        // { maxProducts, maxStaff, maxStorefronts, maxAutomations }
  features Json        // { analyticsExport, discoverBoost, apiAccess }
}

model BillingInvoice {
  id         Int         @id @default(autoincrement())
  businessId Int
  amountSom  Int
  status     String      // PENDING | PAID | FAILED | REFUNDED
  source     String      // finik | manual
  plan       BillingPlan?
  addonKey   String?
  periodStart DateTime?
  periodEnd   DateTime?
  paidAt     DateTime?
  createdAt  DateTime    @default(now())
}
```

---

## 4. Add-on marketplace

| Add-on key | Price model | Gate |
|------------|-------------|------|
| `theme.pack.seasonal` | One-time | Theme install |
| `theme.premium.*` | One-time per theme | Theme marketplace |
| `automation.pack.10` | Monthly | Rule count > plan limit |
| `analytics.pro` | Monthly | Export + 365d range |
| `discover.boost` | Monthly | Featured category slot (limited) |
| `enterprise.sla` | Annual | Support SLA |

**Flow:** Browse add-ons in PlatformPage → Finik checkout → `BillingInvoice` + entitlement unlock.

---

## 5. Theme marketplace

### 5.1 Product shape

| Type | Author | Revenue split |
|------|--------|---------------|
| Official ARCHA themes | Platform | 100% platform |
| Partner themes | Verified creators | 70/30 merchant/platform |
| Merchant custom | Self | N/A |

### 5.2 Schema (from ecosystem architecture)

```prisma
model ThemeListing {
  id          Int           @id @default(autoincrement())
  slug        String        @unique
  name        String
  industry    BusinessType?
  priceSom    Int           @default(0)
  previewUrl  String?
  configSeed  Json
  author      String?
  isOfficial  Boolean       @default(false)
  isPublished Boolean       @default(false)
}

model BusinessThemeInstall {
  id         Int      @id @default(autoincrement())
  businessId Int
  themeId    Int
  purchasedAt DateTime @default(now())
  @@unique([businessId, themeId])
}
```

### 5.3 Launch sequence

1. **5 official free themes** — prove install flow  
2. **3 premium official packs** — seasonal (Navruz, winter)  
3. **Partner program** — manual review, no open upload v1  
4. **In-app preview** — builder preview before purchase  

**Dependency:** `PlanEntitlement` + Finik add-on invoice before paid themes.

---

## 6. Automation & analytics subscriptions

| Product | FREE | Paid add-on |
|---------|------|-------------|
| Smart alerts | Basic | Advanced triggers |
| Automation rules | 0 rules | Pack expansions |
| Growth dashboard | ✅ | Benchmark vs category (GROWTH+) |
| Export CSV | ❌ | `analytics.pro` |
| Co-purchase insights | ❌ | GROWTH plan |

Reuse existing `AutomationRule` schema and AI commerce services — **gate by plan**, don’t rebuild.

---

## 7. Enterprise offerings

| Feature | Enterprise |
|---------|------------|
| Multi-store under one org | ✅ |
| Custom domain / white-label (future) | Optional |
| API + webhooks | ✅ |
| Dedicated support | ✅ |
| Custom SLA | ✅ |
| Manual invoicing | ✅ |

**Sales motion:** Operator-assisted onboarding, not self-serve checkout.

---

## 8. Enforcement implementation order

1. `PlanEntitlement` seed data + `GET /api/platform/billing/status`  
2. Product create gate (`maxProducts`)  
3. Staff invite gate  
4. Automation create gate  
5. Analytics range gate  
6. Theme install gate  
7. Add-on purchase flow  

**Soft vs hard limits:**

| Limit | Behavior |
|-------|----------|
| Products | Hard block create |
| Analytics range | Soft clamp in API |
| Subscription expired | **Existing** soft lock via `subscriptionAccess` |

---

## 9. Revenue model (illustrative)

Assumptions: 200 active merchants at maturity.

| Stream | % merchants | ARPU/mo | MRR |
|--------|-------------|---------|-----|
| STARTER subscription | 50% | 990 | 99,000 |
| GROWTH subscription | 25% | 2490 | 124,500 |
| Theme add-ons | 15% | 300 avg | 9,000 |
| Analytics/automation add-ons | 10% | 500 | 10,000 |
| Enterprise (2 accounts) | 1% | 15000 | 30,000 |

**Total illustrative MRR:** ~272,500 сом — validate with real conversion data.

---

## 10. Metrics

| Metric | Target |
|--------|--------|
| Free → paid conversion | 15–25% within 60 days |
| ARPU | Track monthly |
| Add-on attach rate | 10%+ on GROWTH |
| Churn (monthly) | < 5% on paid |
| LTV:CAC | > 3:1 when paid acquisition starts |

---

## 11. Phase map

| Phase | Deliverable |
|-------|-------------|
| **0 (now)** | This strategy + plan catalog decision |
| **1** | `PlanEntitlement` schema, billing status API, UI plan badge |
| **2** | Limit enforcement on products/staff |
| **3** | Add-on invoices via Finik |
| **4** | Theme marketplace v1 (official only) |
| **5** | Partner themes + enterprise sales kit |

---

## Related docs

- [Platform Ecosystem Architecture — Billing §4](./platform-ecosystem-architecture.md)
- [Ecosystem Consolidation Strategy](./ecosystem-consolidation-strategy.md)
- [Marketplace Dominance Strategy](./marketplace-dominance-strategy.md)
