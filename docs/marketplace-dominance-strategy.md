# Marketplace Dominance Strategy

> **Goal:** ARCHA Discover becomes the default way buyers find Telegram commerce — not random bot links.

---

## 1. Position in the stack

```
Buyer journey:
  Telegram / share link → ARCHA Discover → Storefront → Checkout
                              ↑
                    Platform-owned demand layer
```

**Dominance criterion:** A merchant on ARCHA gets **incremental traffic** from the network that they cannot get with a standalone bot.

---

## 2. Current marketplace layer (baseline)

| Component | Status |
|-----------|--------|
| `PlatformStoreListing` | ✅ Schema + sync on publish |
| Opt-in visibility | ✅ `isPublic` toggle on PlatformPage |
| Public API | ✅ `GET /api/discover/stores` |
| Store detail | ✅ `GET /api/discover/stores/:slug` |
| Trending | ✅ `trendScore` (7d STORE_VIEW) |
| Featured | ✅ Schema; no operator UI yet |
| Browse UI | ✅ `/discover` — basic list + category chips |
| Product-level discover | ❌ Not built |
| Personalization | ❌ Not built |
| Curated collections | ❌ Not built |

---

## 3. Marketplace product architecture

### 3.1 Layers

| Layer | User sees | Backend |
|-------|-----------|---------|
| **Explore** | Home: featured, trending, categories | `listDiscoverStores` + collections |
| **Search** | Query + filters | PG trigram / Meilisearch (T2) |
| **Store profile** | Public card: logo, tagline, badges, CTA | Extend `PublicStoreCard` |
| **Product rails** | Trending products across network | `PlatformProductIndex` (new) |
| **Collections** | “Лучшие кофейни”, “Новинки недели” | `DiscoverCollection` (new) |

### 3.2 Ranking model (Phase 1 — rule-based)

**Do not use ML at launch.** Transparent rules build merchant trust.

```
store_rank =
  featured_boost (operator)
  + trendScore * 1.0
  + qualityScore * 0.5
  + verified_boost
  + recency_decay(publishedAt)
```

| Signal | Source |
|--------|--------|
| `trendScore` | `StorefrontEvent` STORE_VIEW, 7d window |
| `qualityScore` | Readiness + order fulfillment + design score (Phase 2) |
| `featuredRank` | Operator manual |
| `verifiedAt` | Operator approval |

### 3.3 Curated collections (Phase 2 schema)

```prisma
model DiscoverCollection {
  id          Int      @id @default(autoincrement())
  slug        String   @unique
  title       String
  subtitle    String?
  coverUrl    String?
  kind        String   // seasonal | category | editorial | trending
  isPublished Boolean  @default(false)
  sortOrder   Int      @default(0)
  items       DiscoverCollectionItem[]
}

model DiscoverCollectionItem {
  id           Int @id @default(autoincrement())
  collectionId Int
  businessId   Int?
  productId    Int?
  sortOrder    Int @default(0)
}
```

---

## 4. Merchant showcase ecosystem

| Showcase type | Phase | Operator | Merchant |
|---------------|-------|----------|----------|
| Featured merchants | Phase 1 | Set `isFeatured` + rank | Opt-in public listing |
| Top storefronts | Phase 1 | Weekly manual + trendScore | Quality threshold |
| Best designs | Phase 2 | Design score from theme completeness | — |
| Trending stores | **Live** | Auto from events | — |
| Seasonal showcases | Phase 2 | `DiscoverCollection` kind=seasonal | Campaign themes |
| Success stories | Phase 2 | Landing CMS | Merchant interview |

### Merchant-facing UX

- PlatformPage: “Your store in Discover” status + tips to improve rank  
- Admin: “Visibility” panel — public toggle, quality score, badge progress  
- Notification: “You’re trending this week” (engagement loop)

---

## 5. Public marketplace UX roadmap

### Phase 1 — Discover v2 (brand + rails)

- [ ] ARCHA Discover header + ecosystem copy  
- [ ] Sections: Featured → Trending → Categories  
- [ ] Store card v2: logo, tagline, badges placeholder, business type  
- [ ] Empty state: “Скоро здесь появятся магазины” → CTA for merchants  
- [ ] Link from storefront footer: “Explore more on ARCHA”  

### Phase 2 — Products + collections

- [ ] `PlatformProductIndex` — denormalized public product cards  
- [ ] `/discover/products` rail  
- [ ] Collection pages `/discover/c/:slug`  
- [ ] Category hubs `/discover/category/coffee`  

### Phase 3 — Personalization

- [ ] Recent stores (localStorage / TG user)  
- [ ] “Because you viewed X” (same category)  
- [ ] Follow favorite stores (customer profile)  

**Product index schema (Phase 2):**

```prisma
model PlatformProductIndex {
  id           Int      @id @default(autoincrement())
  businessId   Int
  productId    Int
  slug         String
  title        String
  priceSom     Int
  imageUrl     String?
  categoryName String?
  isPublic     Boolean  @default(false)
  trendScore   Int      @default(0)
  updatedAt    DateTime @updatedAt
  @@unique([businessId, productId])
  @@index([isPublic, trendScore])
}
```

---

## 6. Cross-store discovery (network effects)

| Placement | Description |
|-----------|-------------|
| Storefront home rail | “Другие магазины в ARCHA” — 4 cards same category |
| Post-checkout | “Explore marketplace” soft CTA |
| Merchant admin | “Partner stores” for collaborations |
| Share metadata | OG tags point to store; platform link in footer |

**Event tracking (extend):**

| Event | Purpose |
|-------|---------|
| `DISCOVER_IMPRESSION` | Rail / list visibility |
| `DISCOVER_CLICK` | Store open from network |
| `COLLECTION_VIEW` | Editorial performance |

---

## 7. Operator playbook

1. **Weekly:** Review top `trendScore`, set 3–5 `isFeatured`  
2. **On publish:** Ensure `syncPlatformStoreListing` ran; nudge merchant to opt-in public  
3. **Quality gate:** Delist stores with abuse reports or `qualityScore < 30`  
4. **Seasonal:** Create collection for holidays (Navruz, New Year, 8 March)  
5. **Cron:** `refreshDiscoverTrendScores()` daily  

---

## 8. Dominance metrics

| KPI | Definition |
|-----|------------|
| Network GMV share | % orders where buyer touched Discover in session |
| Listing adoption | % published stores with `isPublic` |
| Discover DAU | Unique viewers of `/discover` |
| Click-through | Clicks / impressions |
| Merchant incremental orders | Orders attributed to `DISCOVER_CLICK` |

---

## 9. Non-goals

| Avoid | Why |
|-------|-----|
| Cross-store single cart | Complexity; discovery first |
| Paid placement auction | Trust risk before verification layer |
| ML ranking v1 | Opaque; merchants won’t trust |
| Full Amazon clone | Focus TG-native mobile commerce |

---

## Related docs

- [Ecosystem Consolidation Strategy](./ecosystem-consolidation-strategy.md)
- [Platform Brand Audit](./platform-brand-audit.md)
- [Business Growth Expansion](./business-growth-platform-expansion.md)
