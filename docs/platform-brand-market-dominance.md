# Platform Brand + Market Dominance + Ecosystem Consolidation

> **Master roadmap** for the phase after Business Growth + Platform Expansion.  
> **North star:** ARCHA feels like a **standalone Telegram-native commerce platform** — not a bot builder.

---

## Strategic shift

| Previous phase | This phase |
|----------------|------------|
| Growth systems, retention, referrals, discover v1 | **Brand recognition, marketplace dominance, ecosystem lock-in** |
| “Platform works” | “Platform is the default choice” |
| Feature delivery | **Network + trust + monetization maturity** |

---

## Phase 0 — Strategy (current step) ✅

Deliverables:

| Document | Purpose |
|----------|---------|
| [Platform Brand Audit](./platform-brand-audit.md) | Naming, visual, tone gaps; ARCHA consolidation |
| [Ecosystem Consolidation Strategy](./ecosystem-consolidation-strategy.md) | Network effects, trust, community, expansion APIs |
| [Marketplace Dominance Strategy](./marketplace-dominance-strategy.md) | Discover v2, collections, product index, ranking |
| [Platform Monetization Strategy](./platform-monetization-strategy.md) | Plans, add-ons, theme marketplace, enterprise |

**Decision log (recommended before Phase 1 build):**

1. Confirm platform name: **ARCHA**  
2. Confirm primary tagline: **Commerce OS для Telegram**  
3. Confirm plan tiers: FREE / STARTER / GROWTH / ENTERPRISE  
4. Confirm marketplace ranking: rule-based (no ML v1)  

---

## Phase 1 — Brand + Discover v2

**Goal:** One brand everywhere; marketplace feels intentional.

| Workstream | Deliverables |
|------------|--------------|
| Brand unification | `platformIdentity.ts`, logo SVG, copy pass |
| Discover UX | Featured / trending / category sections |
| Operator tools | Featured merchant toggle, trend refresh cron |
| Landing v0 | Single-page marketing shell (static or Vite route `/welcome`) |
| Analytics | `DISCOVER_IMPRESSION`, `DISCOVER_CLICK` events |

---

## Phase 2 — Trust + monetization foundation

| Workstream | Deliverables |
|------------|--------------|
| Trust layer | Verified badge, quality score, storefront reliability |
| Billing v2 | `PlanEntitlement`, billing status API, product limits |
| Theme marketplace v1 | 5 official themes, install flow |
| Merchant academy v1 | 5 tutorial cards in admin |
| Showcase | Curated collections (operator) |

---

## Phase 3 — Network + community

| Workstream | Deliverables |
|------------|--------------|
| Collaborations | Merchant co-promo links |
| Customer layer | Favorites, loyalty points |
| Product discover | `PlatformProductIndex`, trending products |
| Community | ARCHA merchant Telegram channel |
| Partner API | Read-only discover + store meta |

---

## Phase 4 — Dominance + scale

| Workstream | Deliverables |
|------------|--------------|
| Personalization | Recent / recommended stores |
| Enterprise | Custom plans, API keys, SLA |
| Global readiness | i18n (ru/ky/en), multi-currency |
| Operator dashboards | Ecosystem rollup, churn cohorts |
| Premium UX pass | “Commerce OS” polish across all surfaces |

---

## User goals → phase map

| # | Goal | Phase |
|---|------|-------|
| 1 | Full brand ecosystem | 0 audit → 1 implementation |
| 2 | Landing ecosystem | 1 v0 → 4 full |
| 3 | Merchant showcase | 1 featured → 2 collections |
| 4 | Network effects | 1 cross-rails → 3 collaborations |
| 5 | Theme marketplace | 2 official → 4 partner |
| 6 | Trust / quality | 2 |
| 7 | Public marketplace layer | 1 discover v2 → 3 products |
| 8 | Monetization maturity | 2 plans → 4 enterprise |
| 9 | Growth infrastructure | 2 academy |
| 10 | Platform community | 3 |
| 11 | Ecosystem retention | 2 achievements → 3 loyalty |
| 12 | Commerce trust layer | 2 |
| 13 | Expansion readiness | 2 interfaces → 3 API |
| 14 | Global readiness | 4 |
| 15 | Final UX maturity | 1–4 continuous |
| 16 | Founder tooling | 2 rollups → 4 dashboards |
| 17 | Strategic direction | This document |
| 18 | Phased execution | Phase 0 → 1 next |

---

## What NOT to build yet

- Native iOS/Android apps  
- Cross-store unified cart  
- Open theme upload without moderation  
- ML discover ranking  
- Crypto payments  
- Full rebrand of merchant storefronts to ARCHA visual  

---

## Existing code to extend (don't rewrite)

| Area | Path |
|------|------|
| Discover | `platformDiscoverService.ts`, `DiscoverPage.tsx` |
| Referrals | `merchantReferralService.ts` |
| Growth | `merchantGrowthDashboardService.ts` |
| Billing | `saasBillingService.ts`, `subscriptionAccess.ts` |
| Themes | `themeSystem/`, `StorefrontConfig` |
| Brand fragments | `archaUi.ts`, `ArchaHeader.tsx`, `brand.ts` |

---

## Success definition

Merchants:

- **Recognize** ARCHA instantly (brand)  
- **Trust** verified stores and platform checkout (trust)  
- **Recommend** ARCHA to other merchants (referrals)  
- **Stay** because of network traffic + tools (ecosystem)  
- **Pay** as they grow, not to unlock basics (monetization)  

---

## Related docs

- [Long-Term Platform Evolution (stability phase)](./long-term-platform-evolution.md)
- [Business Growth + Platform Expansion](./business-growth-platform-expansion.md)
- [Platform Ecosystem Architecture](./platform-ecosystem-architecture.md)
- [AI Commerce Platform](./ai-commerce-platform-architecture.md)
- [Release Preparation](./release-preparation-validation.md)
