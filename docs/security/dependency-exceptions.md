# Dependency Security Exceptions

> **Phase 18** — documented accepted risks from `npm audit`. Review quarterly.

---

## Policy

1. Run `node scripts/security-audit.mjs` before each release.
2. CI runs the same script with `continue-on-error: true` until baseline is clean.
3. Exit code 1 on **critical** vulnerabilities — must fix or document exception below.
4. No major version bumps unless required for a CVE fix.

---

## Current exceptions

| Package | Severity | Reason | Review date |
|---------|----------|--------|-------------|
| root transitive (see `npm audit`) | critical | 1 critical in root tree at Phase 18 closeout — run `npm audit` and patch; CI uses continue-on-error | 2026-09-01 |

Add rows when accepting a risk:

```
| example-pkg | high | Transitive dev-only; no production bundle path | YYYY-MM-DD |
```

---

## Commands

```bash
npm audit --audit-level=high
cd frontend && npm audit --audit-level=high
node scripts/security-audit.mjs
```

---

## Related

- [Phase 18 Final Report](./phase-18-final-report.md)
- [CI workflow](../../.github/workflows/ci.yml)
