# Storefront / Catalog Ultra Redesign — Audit & Architecture

> **Goal:** Premium Telegram commerce feel (Temu / Ozon mobile / WB / TikTok Shop tier).  
> **Not:** desktop website, Figma-like builder, heavy animations.  
> **Governance:** preset-first — merchants customize within safe locked hierarchy.

---

## 1. Current architecture (audit)

```
HomePage
  └─ StorefrontContainer → StorefrontPayloadContext (GET /api/storefront/…)
       └─ StorefrontRenderer
            ├─ fetch /products (tenant header)
            ├─ StorefrontFeed (cosmetic wrapper)
            ├─ CMS sections loop (hero, categories, featured, …)
            ├─ FeaturedProductsSection «Хиты» + DiscoveryRails afterGrid
            └─ ProductDetailSheet (portal)
```

### Weak points

| Area | Issue |
|------|--------|
| Feed | «Хиты» + discovery rails = disconnected blocks; duplicate titles |
| Discovery | Trending = re-sorted featured (overlap); session rails don’t refresh live |
| Cards | `businessType` not passed → default CTA/badges; variant CSS classes unused |
| Hero | Carousel exists but weak commerce presence; fashion «EDITORIAL» EN leak |
| Categories | Not sticky; chip clicks don’t record affinity |
| Chrome | Sticky cart z-index 40 vs sheet 2800; sticky visible during product sheet |
| Motion | Static; no token-driven press/transition system |
| Layout | `DiscoveryRail.layout` defined but never rendered differently |
| Performance | DiscoveryRails duplicate `/products` fetch when catalog undefined |

---

## 2. Target architecture

```mermaid
flowchart TB
  payload[Storefront Payload API]
  catalog[Single /products fetch]
  session[Commerce Session + subscribe]
  feed[buildUnifiedCommerceFeed]
  render[CommerceDiscoveryFeed]
  cards[ProductCard + presets]
  chrome[Mobile Chrome Layer]

  payload --> feed
  catalog --> feed
  session --> feed
  feed --> render
  render --> cards
  chrome --> App + StorefrontFeed
```

### Layer responsibilities

| Layer | Path | Role |
|-------|------|------|
| Feed builder | `storefront/unifiedFeed.ts` | Merge hits + rails, dedupe, rhythm metadata |
| Feed UI | `discovery/CommerceDiscoveryFeed.tsx` | One connected commerce stream |
| Session | `runtime/commerceSession.ts` | Views, affinities, reactive updates |
| Motion | `storefront/motionTokens.css` | Duration, easing, press — token-driven |
| Chrome | `storefront/mobileChrome.css` | z-index stack, safe-area, sheet conflicts |
| Cards | `storefront/commerceCards.css` | Premium mobile density (locked presets) |
| Feed rhythm | `storefront/storefrontFeed.css` | Section spacing, transitions |
| Presets | `catalogCardPresets.ts` | Merchant-safe card layouts (unchanged API) |

---

## 3. UX map — commerce discovery flow

```
[Identity band?]
    ↓
[Hero carousel — commerce banners]
    ↓
[Sticky category chips rail]
    ↓
┌─ Unified Commerce Feed ─────────────────┐
│  Primary grid (Хиты / catalog)          │
│  ─── soft divider ───                   │
│  Rail: В тренде (horizontal snap)       │
│  Rail: Вы смотрели                      │
│  Rail: Потому что вы смотрели           │
└─────────────────────────────────────────┘
    ↓
[Catalog footer slider?]
    ↓
[ProductDetailSheet — sticky CTA]
```

---

## 4. Phased implementation

### Phase 0 — Audit & plan ✅ (this document)

### Phase 1 — Feed + session + chrome (current PR)
- [x] `subscribeCommerceSession` + reactive discovery
- [x] `buildUnifiedCommerceFeed` + dedupe across rails
- [x] `CommerceDiscoveryFeed` connected layout + rail snap
- [x] Mobile chrome: sticky hidden during sheet; z-index tokens
- [x] Categories sticky rail + `recordViewCategory`
- [x] `businessType` wired to ProductCard engines
- [x] Motion tokens + commerce card CSS foundation

### Phase 2 — Cards & presets
- [ ] Layout variant CSS (`--arch-marketplace`, `--arch-fashion`, editorial)
- [ ] Wire `overlay_cta` / `bottom_cta` preset names to real layouts
- [ ] Compact quantity controls; image-first 4:5 default
- [ ] `loading="lazy"` + decode hints; memo ProductCard

### Phase 3 — Hero engine
- [ ] Commerce hero presets (seasonal, promo, brand)
- [ ] Unified carousel for all kits (not fashion-only editorial)
- [ ] Builder fields: overlay, heightMode, ctaPosition (already partial)

### Phase 4 — Product detail sheet
- [ ] Premium gallery snap + sticky CTA bar
- [ ] Related products rail inside sheet
- [ ] Variant chips redesign

### Phase 5 — Responsive shell
- [ ] Centered commerce shell max-width on desktop/tablet
- [ ] Container queries for rail column counts
- [ ] Landscape safe-area

### Phase 6 — Performance
- [ ] Virtualize long catalog (if >80 SKUs)
- [ ] Image size policy per viewport tier
- [ ] Reduce motion cost audit

---

## 5. Design governance rules

1. **Spacing** — only `--sf-feed-gap`, `--sf-rail-gap` tokens; merchants cannot override.
2. **Grid columns** — container queries in `commerceShell.css`; preset picks density tier only.
3. **Typography** — card title max 2 lines; price always visible (locked hierarchy).
4. **CTA** — one primary action per card; quantity stepper secondary.
5. **Motion** — `data-sf-motion=reduced|normal|expressive`; default `normal`; no glow.

---

## 6. File index

| Concern | Files |
|---------|--------|
| Orchestration | `StorefrontRenderer.tsx`, `StorefrontFeed.tsx` |
| Discovery | `discoveryFeedRegistry.ts`, `CommerceDiscoveryFeed.tsx` |
| Cards | `ProductCard.tsx`, `ProductGrid.tsx`, `commerceCards.css` |
| Hero | `HeroSection.tsx`, `storefrontKits.css` |
| Categories | `CategoriesSection.tsx` |
| Detail | `ProductDetailSheet.tsx` |
| Chrome | `App.tsx`, `StickyCartBar`, `FloatingCart`, `mobileChrome.css` |
