# Complexity Audit

> **Phase:** Founder Exit — Audit 3/3  
> **Question:** Where is the platform **over-engineered or overloaded** — and what should we **remove or freeze**?

---

## 1. Executive summary

| Category | Verdict |
|----------|---------|
| Core commerce path | **Appropriate** — storefront + orders + admin |
| Intelligence layer | **Partially premature** — some stubs without runners |
| UI architecture | **Over-complex** — 3 CSS systems, dual navigation |
| Server architecture | **Under-modularized** — god file, not over-microserviced |
| Ecosystem features | **Right direction, early** — discover OK; product index wait |
| Documentation | **Over-strategized vs under-operational** — 25+ docs, gaps in runbooks |

**Strategic simplification theme:** **Subtract before add.** Freeze new subsystems for 4 weeks.

---

## 2. Complexity heat map

| Area | Complexity | Value | Action |
|------|------------|-------|--------|
| Storefront tokensV3 + builder | High | **High** | Keep — core IP |
| `index.ts` monolith | High | Medium | Split routes — simplify navigation |
| AI commerce services | Medium | Medium | Keep; no new AI surfaces until adoption measured |
| `AutomationRule` schema | Low code, future debt | Low today | **Freeze** — no UI until runner exists |
| Discover marketplace | Medium | Medium | Keep v1; defer product index |
| Referrals | Low | Medium | Keep |
| Growth dashboard | Medium | High | Keep |
| Theme marketplace (planned) | High | Unknown | **Later** — validate demand |
| Loyalty / cross-store cart | Very high | Low now | **Never** (documented) |
| Greenfield UI migration | Medium | High | Incremental — no big bang |
| Platform strategy docs | Low code | Medium | Consolidate; don’t write more until ops live |

---

## 3. UX overload audit

| Surface | Overload signal | Simplify |
|---------|-----------------|----------|
| Admin nav | Many tabs | Group: Sell / Design / Ops / Growth |
| PlatformPage | Long merchant card | Collapse operator-only actions |
| Checkout | Multiple payment paths | Single happy path + clear fallback copy |
| Onboarding | Wizard + readiness + growth | One primary CTA path |
| Design editor | Raw IDs, many blocks | Progressive disclosure |
| Error UX | `alert()` 30+ | Inline alerts only |

**Rule:** One primary action per screen for merchants.

---

## 4. Technical overengineering

| Item | Why it feels heavy | Recommendation |
|------|-------------------|----------------|
| Dual storefront config SoT | Two publish paths | Pick one; deprecate other |
| Dual auth models | Security + mental load | Unified initData — simplify model |
| CustomEvent bus | Hidden deps | Replace with query invalidation |
| Client + server permission copies | Drift risk | Shared types once |
| In-request trend recompute | Accidental complexity | Move to cron |
| Multiple bot launch paths | Hard to debug | Document single diagram |

**Not overengineering (keep):**

- Prisma schema richness  
- Storefront public API schema validation  
- Operator unlock sessions  
- `StorefrontEvent` analytics  

---

## 5. Features to NOT build (reaffirmed)

From governance + ecosystem docs — **freeze list**:

| Feature | Reason |
|---------|--------|
| Cross-store cart | Network = discovery only |
| Native apps | TG + PWA sufficient |
| ML discover ranking | Rule-based enough |
| Open theme upload | Moderation + billing first |
| Microservices | Monolith + worker |
| GraphQL | REST sufficient |
| Crypto payments | Region focus Finik |
| DAO / token loyalty | Off-brand |
| Enterprise SSO | After unified auth + 50+ merchants |

---

## 6. Features to simplify (active debt)

| Target | From | To |
|--------|------|-----|
| Auth | 2 models | 1 initData model |
| CSS | 3 stacks | 3 **scoped** surfaces (not 3 globals) |
| Navigation | Router + App state | Router only |
| Payment polling | 2 intervals | 1 state machine |
| Merchant errors | alert() | InlineAlert |
| Deploy | Founder memory | Checklist + staging |

---

## 7. Documentation complexity

| Issue | Action |
|-------|--------|
| 25+ markdown files | Hub in `docs/README.md` ✅ |
| Strategy > operations | Pause new strategy docs |
| Missing operational | Add incident, local dev, billing FAQ |
| ADRs scattered | `docs/decisions/` folder for new only |

---

## 8. Complexity budget (operating rule)

**Complexity budget:** Max **3** engineering initiatives in “Now”.

Each initiative must **remove** complexity OR **prove** merchant metric impact.

| Allowed | Not allowed |
|---------|-------------|
| Refactor route split | New marketplace subsystem |
| Auth unification | New automation UI without runner |
| Discover v2 polish | Theme marketplace |
| Sentry + staging | AI feature expansion |
| Dead code removal | New integration |

---

## 9. Simplification scorecard

| Metric | Current | Target 90d |
|--------|---------|------------|
| `index.ts` lines | ~4750 | < 800 bootstrap |
| Dead component files | ~6 | 0 |
| `alert()` calls | ~30 | < 5 |
| Undocumented critical flows | ~5 | 0 |
| Systems without owner metric | ~3 | 0 |
| New subsystems / month | Uncontrolled | ≤ 1 ( gated ) |

---

## 10. Phase 1 simplification actions

| # | Action | Impact |
|---|--------|--------|
| 1 | Delete dead UI files (modal, Toast, Layout) | Low risk cleanup |
| 2 | Freeze AutomationRule UI | Stops creep |
| 3 | Move discover trend to cron | Removes request-path complexity |
| 4 | Publish `platform-vision.md` non-goals | Decision shortcut |
| 5 | Max 3 Now on roadmap | Focus |

---

## Related docs

- [Governance Audit](./governance-audit.md)
- [Architecture Review](../reviews/architecture-review.md)
- [Platform Vision](../platform-vision.md)
- [Maintainability Review](../reviews/maintainability-review.md)
