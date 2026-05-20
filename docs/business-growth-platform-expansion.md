# Business Growth + Platform Expansion

> **Phase shift:** from «platform works» to **merchant success, retention, growth, ecosystem adoption**.  
> **North star:** merchants stay, earn, refer others, and scale inside the platform.

---

## Philosophy

| Before (Release) | Now (Growth) |
|------------------|--------------|
| Stability, UX polish, validation | Merchant outcomes |
| Feature completeness | Retention + referrals + discovery |
| Endless development | Measured growth loops |

The platform should feel like a **living mobile commerce ecosystem inside Telegram**, not a Mini App builder.

---

## Phase 1 — Shipped foundation (this iteration)

### 1. Merchant growth system

| Capability | Implementation |
|------------|----------------|
| Growth dashboard | `POST /merchant/growth/dashboard` → `merchantGrowthDashboardService` |
| Conversion insights | Reuses `merchantInsightsService` |
| Sales recommendations | Growth score + optimization tips |
| Storefront optimization tips | Readiness + growth checklist |
| Onboarding completion score | Growth score checklist |
| Growth milestones | Milestone list in dashboard |

**UI:** Admin → Аналитика → вкладка **«Рост»** (`AdminAnalyticsPage`).

### 2. Retention system

| Capability | Implementation |
|------------|----------------|
| Engagement analytics | Orders/revenue/conversion in dashboard |
| Inactivity detection | `merchantRetentionService` (active / at_risk / inactive) |
| Reactivation flows | Retention nudges → `MerchantNotification` |
| Setup reminders | Existing readiness + smart alerts |
| Growth nudges | Emitted on analytics/dashboard load |

### 3. Referral ecosystem

| Capability | Implementation |
|------------|----------------|
| Merchant referrals | `MerchantReferralCode`, `MerchantReferralSignup` |
| Partner links | `GET /api/platform/referral?businessId=` |
| Referral analytics | Signup count in dashboard + PlatformPage |
| Attribution on register | `?ref=` → `recordReferralSignup()` |

**UI:** PlatformPage — copy referral link; MerchantRegisterPage — `?ref=` param.

### 4. Marketplace discovery

| Capability | Implementation |
|------------|----------------|
| Public store directory | `PlatformStoreListing` |
| Featured / trending | `isFeatured`, `trendScore` (operator refresh TBD) |
| Category discovery | `GET /api/discover/stores?type=` |
| Merchant opt-in | `POST /api/platform/store-listing/visibility` |
| Public browse UI | `/discover` (`DiscoverPage`) |

**Sync:** listing upserted on storefront publish (`syncPlatformStoreListing`).

---

## Phase 2 — Next (loyalty, campaigns, monetization)

Planned after Phase 1 validation with real merchants:

| Area | Direction |
|------|-----------|
| Customer retention | Loyalty, rewards, cashback, favorite stores |
| Commerce campaigns | Scheduled promos, launch banners, holiday modes |
| Platform monetization | Premium plans, analytics tiers, theme marketplace |
| Branding tools | Brand kits, seasonal themes, campaign presets |
| Ecosystem tools | Shared campaigns, collaborations, influencer links |

Schema-first; no UI until merchant feedback confirms demand.

---

## Phase 3 — Platform identity + success program

| Area | Deliverables |
|------|--------------|
| Public identity | Platform naming, SaaS branding, landing ecosystem |
| Merchant success | Tutorials, growth playbooks, onboarding academy |
| Mobile excellence | Telegram-native UX, fast storefront, low-friction checkout |
| Scalability | CDN, queue scaling, analytics cost control |
| Long-term | External integrations, native apps, partner APIs, enterprise |

---

## Key API surface (Phase 1)

```
POST /merchant/growth/dashboard     — merchant staff (analytics permission)
GET  /api/discover/stores           — public marketplace list
GET  /api/discover/stores/:slug     — public store card
GET  /api/platform/referral         — referral link + isPublic flag
POST /api/platform/store-listing/visibility — opt-in to marketplace
```

---

## Operator follow-ups

1. Run migration `20260621180000_business_growth_expansion` on production.
2. Backfill `PlatformStoreListing` for already-published stores (script or re-publish).
3. Schedule `refreshDiscoverTrendScores()` (cron / operator action).
4. Feature stores via `isFeatured` when curated collections launch.

---

## Release focus (ongoing)

- **Merchant success** over feature count
- **Retention loops** over one-time onboarding
- **Referral + discovery** over isolated storefronts
- **Evidence from real merchants** before Phase 2 build-out

---

## Related docs

- [Long-Term Platform Evolution (next phase)](./long-term-platform-evolution.md)
- [Platform Brand + Market Dominance (next phase)](./platform-brand-market-dominance.md)
- [AI Commerce Platform](./ai-commerce-platform-architecture.md)
- [Platform Ecosystem](./platform-ecosystem-architecture.md)
- [Release Preparation](./release-preparation-validation.md)
- [Operator Runbook](./guides/operator-runbook.md)
