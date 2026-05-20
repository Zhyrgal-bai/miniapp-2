# Platform Standards

> **Internal conventions** — reduce founder-only knowledge. New code should match these patterns.

---

## 1. Naming conventions

### 1.1 Database (Prisma)

| Rule | Example |
|------|---------|
| Models PascalCase singular | `PlatformStoreListing` |
| Fields camelCase | `businessId`, `isPublic` |
| Booleans `is*` / `has*` | `isFeatured`, `isBlocked` |
| Timestamps `*At` | `publishedAt`, `createdAt` |
| JSON config fields descriptive | `themeConfig`, `featureFlags` |

### 1.2 API routes

| Prefix | Purpose |
|--------|---------|
| `/api/platform/*` | SaaS, initData auth |
| `/api/storefront/*` | Public buyer read |
| `/api/discover/*` | Public marketplace |
| `/merchant/*` | Merchant staff (→ unified initData) |
| `/api/merchant/*` | Merchant staff JSON |

**Verbs:** REST-ish — GET read, POST create/action, PATCH partial update.

### 1.3 Frontend files

| Type | Pattern |
|------|---------|
| Pages | `PascalCase` + `Page.tsx` |
| Services | `*.service.ts` or `*Api.ts` |
| Hooks | `use*.ts` |
| Storefront components | under `components/storefront/` |
| Platform chrome | `components/archa/` or `platformIdentity` |

### 1.4 Feature flags

| Scope | Pattern |
|-------|---------|
| Platform | `platformFlags.discover_v2` in registry |
| Merchant | `Business.featureFlags` JSON keys snake_case |

---

## 2. API conventions

| Rule | Detail |
|------|--------|
| Validation | Zod for `/api/platform/*`; extend to merchant |
| Errors | `{ error: string }` + appropriate HTTP status |
| Tenant scope | Always filter by verified `businessId` |
| Public cache | Only on `/api/storefront/*`, `/api/discover/*` |
| Idempotency | Required for payment + order create (future) |
| Deprecation | `Deprecation: true` header + 90d notice |

### Auth (target state)

All privileged routes: `x-telegram-init-data` verified → membership → permissions.

---

## 3. Component conventions

| Surface | Wrapper | Tokens |
|---------|---------|--------|
| Storefront | `data-surface="storefront"` | `--sf-*` |
| Admin | `data-surface="admin"` | `--admin-*` → migrate to tokens |
| Platform | `data-surface="platform"` | `archaUi` / platform tokens |
| Builder | `data-surface="builder"` | inherits storefront |

**New UI:** No global `body` theme mutations from `ThemeContext`.

### Feedback

| Use | Not |
|-----|-----|
| Inline error banner | `alert()` |
| Skeleton loading | Blank screen |
| `role="status"` on success | Silent success |

---

## 4. Builder conventions

| Rule | Detail |
|------|--------|
| SoT | Published config from server resolver |
| Preview | Draft ≠ published until explicit publish |
| Blocks | Registry-driven — no one-off block types |
| Theme | `tokensV3` only for new presets |
| Validation | Server `StorefrontConfigSchema` is final |

---

## 5. Analytics conventions

### Event naming

| Layer | Pattern | Example |
|-------|---------|---------|
| Storefront buyer | `SCREAMING_SNAKE` in DB | `STORE_VIEW`, `ADD_TO_CART` |
| Platform funnel | lowercase dot | `register_submit` |
| Platform ops | `PLATFORM_*` (future) | `PLATFORM_CHURN_RISK` |

### Required fields

- `businessId` where tenant-scoped  
- `createdAt` server-side  
- Never log PII in production info logs  

### Merchant vs platform analytics

| Audience | Data |
|----------|------|
| Merchant | Their `StorefrontEvent`, orders, growth dashboard |
| Platform | Funnel, retention cohorts, feature adoption — aggregated |

---

## 6. Documentation conventions

| Change type | Update |
|-------------|--------|
| New API route | `frontend-api-inventory.md` or route reference |
| New operator procedure | `operator-runbook.md` |
| Architecture decision | `docs/decisions/YYYY-MM-name.md` |
| New feature system | Innovation gate doc + roadmap |

---

## 7. Git & release conventions

| Rule | Detail |
|------|--------|
| Main branch | Always deployable |
| Migrations | One per logical change, committed |
| Check before merge | `npm run check` |
| Prod tag | `vYYYY.MM.DD` on release |
| Hotfix | Branch from tag, forward merge |

---

## Related docs

- [UX Governance](./ux-governance.md)
- [Product Governance](../product-governance.md)
- [Architecture Review](../reviews/architecture-review.md)
