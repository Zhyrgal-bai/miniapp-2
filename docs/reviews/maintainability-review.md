# Maintainability Review

> **Phase:** Long-Term Platform Evolution — Review 3/4  
> **Scope:** Code health, reuse, docs, onboarding new contributors

---

## 1. Executive summary

| Dimension | Grade | Notes |
|-----------|-------|-------|
| Type safety | **B+** | `npm run check` enforced; some `as any` in index |
| Test coverage | **D** | Minimal automated tests |
| Code organization | **C+** | Good services; bad route layer |
| Documentation | **B-** | 20 architecture docs; gaps in API/merchant |
| UI consistency | **C** | Three CSS stacks, dead components |
| Dependency hygiene | **B** | Prisma + React modern; audit npm quarterly |

**Maintainability debt score:** **Medium-High** — manageable with disciplined Phase 1 refactors, not a rewrite.

---

## 2. Codebase metrics

| Metric | Value | Target |
|--------|-------|--------|
| `index.ts` lines | ~4750 | < 300 bootstrap |
| Route handlers in index | ~100 | Domain routers |
| Prisma migrations | 26 | Disciplined; avoid squash until stable |
| Frontend pages | 30+ | OK |
| Architecture docs | 20 | Index + keep updated |
| Automated tests | Few/none | Critical path tests Phase 2 |

---

## 3. Reusable components (frontend)

### 3.1 What works

| Component / pattern | Used by |
|---------------------|---------|
| `StorefrontRenderer` + feed registry | All storefronts |
| `ProductDetailSheet` | Storefront commerce |
| `ArchaHeader` / `archaUi` | Platform merchant |
| `admin.service.ts` | All admin pages |
| `DynamicFieldRenderer` | Merchant settings |

### 3.2 Gaps (should exist)

| Primitive | Current state | Target |
|-----------|---------------|--------|
| `<Button>` | 4+ class naming systems | Single variant API |
| `<InlineAlert>` | alert() in 30+ places | Toast + inline |
| `<LoadingState>` | Text "Загрузка…" | Skeleton standard |
| `<EmptyState>` | Ad hoc per page | Shared |
| Form fields | Mixed | Admin form kit |

**Strategy:** Iterative extraction during UX polish sprints — not a big-bang design system PR.

### 3.3 Dead code (safe removal candidates)

From maturity audit — remove when touching related areas:

| File | Status |
|------|--------|
| `ProductDetailModal.tsx` | Unused |
| `DiscoveryRails.tsx` | Unused |
| `Layout.tsx`, `Toast.tsx` | Never wired |

---

## 4. Styling maintainability

| System | Files | Migration path |
|--------|-------|----------------|
| `--store-*` legacy | `ThemeContext.tsx` | Remove per greenfield Stage 1 |
| `--sf-*` storefront | `storefrontBones`, kits | Keep — canonical for buyer |
| `--admin-*` | `Admin.css` (~2k lines) | Gradual token alignment |
| Tailwind | `archaUi`, PlatformPage | Platform surface standard |

**Rule:** New UI uses `data-surface="platform|admin|storefront"` scoping — no new global body styles.

---

## 5. API client maintainability

| Client | Lines | Issue |
|--------|-------|-------|
| `admin.service.ts` | Large | Single file OK; split by domain if > 800 lines |
| `platformApi.ts` | Medium | Good |
| `api.ts` (axios) | Legacy paths | Consolidate with platformApi over time |

**Contract tests:** Add Zod parse tests for storefront public response (schema exists — add vitest).

---

## 6. Documentation ecosystem

### 6.1 What exists

| Audience | Docs |
|----------|------|
| Operators | `operator-runbook.md`, `release-checklist.md` |
| Merchants | `merchant-quickstart.md` (basic) |
| Architects | 10+ architecture/strategy docs |
| Developers | `frontend-api-inventory.md`, storefront schema doc |

### 6.2 Gaps

| Audience | Missing |
|----------|---------|
| Merchants | Billing FAQ, discover opt-in guide, support SLAs |
| Operators | Moderation playbook, featured merchant SOP |
| Developers | Local setup README section, route map, env glossary |
| API consumers | OpenAPI / typed route list |
| Support | Ticket taxonomy, escalation matrix |

**Phase 2 deliverable:** `docs/README.md` as documentation hub with ownership tags.

---

## 7. Module boundary violations (fix order)

| Priority | Violation | Fix |
|----------|-----------|-----|
| P0 | Business logic in `index.ts` handlers | Move to `*Service.ts` |
| P1 | Frontend permission copy | Import from shared or code-gen |
| P1 | Payment polling in 2 components | Single hook |
| P2 | CustomEvent bus | Query invalidation |
| P2 | Inline SQL in routes | Repository functions |

---

## 8. Developer experience

### 8.1 Local setup friction

| Step | Pain | Improve |
|------|------|---------|
| Env vars | Many required | `docs/guides/local-development.md` |
| Telegram testing | Needs real Mini App | Document ngrok + BotFather flow |
| DB | Postgres required | Docker compose one-liner |
| Migrations | Manual | Document `migrate dev` workflow |

### 8.2 CI recommendation (Phase 1)

```yaml
# Minimal GitHub Actions
- npm run check
- prisma validate
# Future: vitest critical paths
```

---

## 9. Technical debt register (living doc)

Maintain in `docs/tech-debt-register.md` (create in Phase 2) with columns:

| ID | Description | Impact | Effort | Owner | Status |

Seed from maturity audit §2 — ARCH-01 through ARCH-07, dead code list, alert() migration.

---

## 10. Maintainability phase map

| Phase | Focus |
|-------|-------|
| **1** | Split `index.ts`; remove dead code batch; CI check |
| **2** | Doc hub; contract tests; local dev guide |
| **3** | UI primitives; alert() → InlineAlert migration |
| **4** | Shared permissions package; OpenAPI subset |

---

## Related docs

- [Architecture Review](./architecture-review.md)
- [Greenfield UI Stage 1](../greenfield-ui-stage1-tokens.md)
- [Platform Maturity Hardening Audit](../platform-maturity-hardening-audit.md)
