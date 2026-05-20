# Governance Audit

> **Phase:** Founder Exit — Audit 1/3  
> **Question:** Can the product be **governed** without the founder inventing process ad hoc?

---

## 1. Executive summary

| Area | Status | Grade |
|------|--------|-------|
| Written governance framework | Exists (`product-governance.md`) | **B** |
| Governance **operationalized** | Not yet | **D** |
| Roadmap discipline | Strategy docs only | **C** |
| Feature validation | Innovation gate on paper | **D** |
| Deprecation process | Documented, never used | **C** |
| Decision record (ADR) | Partial in reviews | **C** |
| Non-goals list | Multiple docs, not single source | **B-** |

**Verdict:** Governance **designed but not lived**. Founder still acts as implicit PM + CTO + operator.

---

## 2. Founder dependency inventory

Knowledge that lives outside the repo or only in founder memory:

| Domain | Where it lives today | Risk if founder absent |
|--------|----------------------|------------------------|
| Deploy secrets & env matrix | Render/Vercel dashboards + `.env.example` gaps | Deploy fails |
| Operator password rotation | Env only | Lockout |
| Merchant approve criteria | Implicit | Inconsistent approvals |
| Beta cohort marking | Runbook mentions manual DB flag | Forgotten |
| Finik webhook debugging | Founder experience | Payments stuck |
| “What not to build” | Scattered non-goals | Feature chaos returns |
| Priority calls | Founder chat | Wrong work shipped |
| Security P0 awareness | Maturity audit | Regression |
| Billing price changes | Hardcoded in `saasBillingService.ts` | Surprise |

**Mitigation:** [product-operating-model.md](../product-operating-model.md) + expanded runbooks.

---

## 3. Governance artifacts — exist vs used

| Artifact | Exists | Used in practice |
|----------|--------|------------------|
| `product-governance.md` | ✅ | ❌ Not referenced in PR/release flow |
| Innovation gate (8 steps) | ✅ | ❌ No template filled for recent features |
| RICE-lite scoring | ✅ | ❌ |
| Quarterly review agenda | ✅ | ❌ Not scheduled |
| `release-checklist.md` | ✅ | ⚠️ Ad hoc |
| `operator-runbook.md` | ✅ | ⚠️ Partial |
| Architecture reviews | ✅ | ✅ Created |
| `platform-vision.md` | ✅ (this phase) | New |

---

## 4. Feature chaos risk assessment

### 4.1 Built systems (inventory)

| System | Necessary for core vision? | Complexity |
|--------|---------------------------|------------|
| Storefront builder + tokensV3 | **Yes** | High — core |
| Merchant admin + RBAC | **Yes** | Medium |
| SaaS billing + Finik | **Yes** | Medium |
| Growth dashboard + insights | **Yes** — retention | Medium |
| Discover marketplace | **Yes** — ecosystem | Medium |
| Referrals | **Yes** — network | Low |
| AI commerce stubs | **Partial** — validate demand | Medium |
| AutomationRule schema (no runner) | **No yet** — freeze | Low dead weight |
| Multiple CSS stacks | **No** — simplify | High debt |

### 4.2 Chaos indicators (watch)

| Indicator | Current state |
|-----------|---------------|
| Features without metrics | Automation schema, some AI paths |
| Features without docs | Several admin tabs |
| Duplicate systems | Dual auth, dual navigation, dual config SoT |
| “Just one more” integrations | Finik only — good restraint |

**Recommendation:** **Feature freeze on new systems** until Phase 1 operating rhythm runs 4 weeks.

---

## 5. Feature validation process (target)

Every feature proposal → **one-page** `docs/decisions/YYYY-MM-feature-name.md`:

```markdown
## Problem
## Merchant evidence (quote / metric)
## RICE score
## Non-goals
## Schema/API sketch
## Flag name
## Success metric
## Rollback
```

**Gate keeper:** Not founder alone — operator confirms merchant demand for merchant-facing; engineering confirms complexity cost.

---

## 6. Roadmap process gaps

| Gap | Fix |
|-----|-----|
| No visible “Now / Next / Later” board | `docs/roadmap.md` — single page, updated bi-weekly |
| No link between funnel data and roadmap | Monday ritual: funnel drops → backlog |
| Security P0 not on roadmap | Add SEC-01 unified auth to **Now** |
| Brand/marketplace strategy not gated | Strategy = Later until stability Phase 1 done |

---

## 7. Governance maturity scorecard

| Dimension | 0–5 | Target 90d |
|-----------|-----|------------|
| Written process | 4 | 5 |
| Process followed | 1 | 4 |
| Decision records | 2 | 4 |
| Non-goals enforced | 2 | 4 |
| Delegation to operator | 2 | 4 |
| Founder-free deploy | 2 | 4 |

---

## 8. Phase 1 actions (governance)

| # | Action | Owner |
|---|--------|-------|
| 1 | Create `docs/roadmap.md` with max 3 Now items | Founder |
| 2 | Require innovation gate doc for any new system | Engineering |
| 3 | Schedule weekly 30 min ops (Mon) | Operator |
| 4 | Merge non-goals into `platform-vision.md` | Product |
| 5 | Add governance checklist to release process | Engineering |

---

## Related docs

- [Product Governance](../product-governance.md)
- [Complexity Audit](./complexity-audit.md)
- [Platform Vision](../platform-vision.md)
