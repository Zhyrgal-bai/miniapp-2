# Scalability Review

> **Phase:** Long-Term Platform Evolution — Review 2/4  
> **Scope:** Performance, cost, growth limits, bottlenecks

---

## 1. Executive summary

| Tier | Merchant count | Verdict |
|------|----------------|---------|
| **T0 (now)** | 1–100 | Comfortable on Render free/starter |
| **T1** | 100–500 | Needs cache + rollups + worker |
| **T2** | 500–2000 | Needs Redis, read replicas, CDN tuning |
| **T3** | 2000+ | Dedicated workers, event partitioning |

**Current bottleneck ranking:**

1. Monolith CPU (bots + API + cron same process)  
2. Live SQL analytics on `StorefrontEvent`  
3. In-memory storefront cache (no cross-instance)  
4. Full storefront payload rebuild on cache miss  
5. Webhook processing synchronous in request  

---

## 2. Load profile (estimated)

| Endpoint | Relative load | Cache today | Target |
|----------|---------------|-------------|--------|
| `GET /api/storefront/:id` | **Very high** | 60s in-memory | CDN edge + Redis |
| `GET /api/discover/stores` | Medium | None | 5 min cache + cron trend |
| `POST /orders` | Medium | None | Transaction + idempotency key |
| Merchant analytics | Medium-high | None | Daily rollups |
| Telegram webhooks | Spiky | None | Queue + retry |
| Admin CRUD | Low | None | OK |

---

## 3. Database

### 3.1 Schema growth hotspots

| Table | Growth rate | Risk |
|-------|-------------|------|
| `StorefrontEvent` | Linear with traffic | **High** — unbounded |
| `Order` / `OrderItem` | Linear with GMV | Medium |
| `PlatformFunnelEvent` | Low | Low |
| `MerchantNotification` | Per merchant | Medium |
| `PlatformStoreListing` | ~ merchants | Low |

### 3.2 Index recommendations (Phase 2)

```sql
-- StorefrontEvent: analytics queries
CREATE INDEX IF NOT EXISTS idx_storefront_event_biz_type_time
  ON "StorefrontEvent" ("businessId", "eventType", "createdAt" DESC);

-- Orders: merchant dashboard range queries (verify existing)
-- PlatformDailyRollup: replace live aggregation
```

### 3.3 Query patterns to eliminate

| Pattern | Location | Replace with |
|---------|----------|--------------|
| Live 7d groupBy for all businesses | `refreshDiscoverTrendScores` | Nightly job + rollup table |
| Full analytics scan per dashboard load | `merchantAnalyticsService` | `MerchantDailyRollup` |
| N+1 product fetches | Verify order list endpoints | `include` / batch |

---

## 4. Caching strategy

### 4.1 Current

| Layer | Implementation | Limit |
|-------|----------------|-------|
| Storefront JSON | `storefrontCache.ts` Map, 60s TTL | Single Render instance |
| HTTP | `Cache-Control: no-store` on API | Correct for auth routes |
| Client | React state, recently viewed localStorage | OK |

### 4.2 Target cache tiers

| Tier | Content | TTL | Invalidation |
|------|---------|-----|--------------|
| L1 | Storefront public payload | 60–300s | Publish, product update |
| L2 | Discover listings | 300s | Cron + manual featured change |
| L3 | Static assets (Vercel) | Long | Build hash |
| L4 | Cloudinary transforms | CDN default | URL params |

**Phase 1:** Increase storefront TTL to 120s for stable published stores; invalidate on publish webhook.

**Phase 2:** Redis (`UPSTASH_REDIS_URL`) shared across Render instances.

---

## 5. Background jobs & queues

### 5.1 Current

| Job | Where | Problem |
|-----|-------|---------|
| Subscription maintenance | `subscriptionMaintenance.ts` in main | Blocks event loop on spike |
| Trend score refresh | On discover GET | Unbounded work per request |
| Telegram bot polling/webhooks | In-process | Shared fate with API |

### 5.2 Target

```prisma
model JobOutbox {
  id        Int      @id @default(autoincrement())
  kind      String
  payload   Json
  status    String   @default("pending")
  attempts  Int      @default(0)
  nextRunAt DateTime @default(now())
  lastError String?
  createdAt DateTime @default(now())
}
```

| Job kind | Priority | Schedule |
|----------|----------|----------|
| `webhook.retry` | P0 | Immediate + backoff |
| `analytics.rollup.daily` | P1 | 03:00 UTC |
| `discover.trend.refresh` | P2 | Hourly |
| `notification.digest` | P2 | Daily |

**Deploy model:** Second Render **worker** service running `node dist/worker.js` (same repo, different start command).

---

## 6. Media delivery

| Item | Current | Optimization |
|------|---------|--------------|
| Storage | Cloudinary | OK |
| Transforms | Client URL params | Preset sizes: thumb, card, hero |
| Format | Mixed | WebP/AVIF via Cloudinary `f_auto` |
| Lazy load | Partial in storefront | All catalog images |

**Cost control:** Max upload size enforced; delete orphaned media on product purge.

---

## 7. Frontend performance

| Area | Status | Action |
|------|--------|--------|
| Bundle size | Not measured in CI | Add `vite build --report` monthly |
| Storefront first paint | Feed-heavy | Route-level code split for admin |
| Framer Motion | PlatformPage | Lazy load on merchant routes only |
| Analytics beacons | Fire-and-forget | Batch non-critical events |

---

## 8. Infrastructure cost model

**Render free tier constraints:**

- Single instance → no horizontal scale  
- Cold starts → first request slow  
- DB connection limit → watch pool size  

| Growth action | Cost trigger |
|---------------|--------------|
| 100+ active merchants | Upgrade Render plan |
| Discover traffic | CDN / cache |
| Event table > 1M rows | Rollups + archival |
| Multiple bot instances | Worker separation |

**Target:** Infrastructure cost < 15% of MRR at 200 paying merchants (see monetization strategy).

---

## 9. Scalability test plan

| Test | Tool | Pass criteria |
|------|------|---------------|
| Storefront GET p95 | k6 / autocannon | < 400ms @ 50 RPS |
| Order create | k6 | < 800ms @ 10 RPS |
| Discover list | k6 | < 300ms @ 20 RPS |
| DB connections | Render metrics | < 80% pool |
| Event insert rate | Synthetic | 500/min sustained |

Run before T1 (500 merchants) exit.

---

## 10. Phase map

| Phase | Deliverable |
|-------|-------------|
| **1** | Move trend refresh off request path; storefront TTL policy |
| **2** | `JobOutbox` + worker; `StorefrontEvent` rollup |
| **3** | Redis cache; Cloudinary presets |
| **4** | Read replica for analytics; archival policy |

---

## Related docs

- [Architecture Review](./architecture-review.md)
- [Platform Ecosystem Architecture §15](../platform-ecosystem-architecture.md)
- [Operations Platform Architecture](../operations-platform-architecture.md)
