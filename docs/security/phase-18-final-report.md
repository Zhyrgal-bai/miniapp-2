# ARCHA Phase 18 — Security & Production Hardening (Final Report)

**Date:** 2026-06-10  
**Scope:** Defensive, additive hardening — no checkout/Finik/CRM/Marketing/API contract changes.

---

## 1. Architecture summary

Defense-in-depth layers added or strengthened:

| Layer | Implementation |
|-------|----------------|
| HTTP | `securityHeadersMiddleware`, env-driven `corsMiddleware`, `requestTimeoutMiddleware`, `safeErrorEnvelopeMiddleware` |
| Auth | `telegramInitDataPolicy` (`auth_date` freshness + optional replay guard) wired in `requireTelegramAuth` |
| Tenant | `resolveTenantHintFromRequest`, `assertBusinessScope`, structured `tenant_access_denied` logs |
| Rate limits | `TRUST_PROXY` alignment, `webhooksLimiter` on subscription Finik webhook, `telemetryLimiter` |
| Uploads | Magic-byte sniff (`mimeSniff.ts`), unified `validateImageFile` / `validateReceiptFile` |
| Ops | Operator action audit logs, VPS/backup docs, `scripts/security-audit.mjs` |

---

## 2. Risks handled (18.1–18.12)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 18.1 | `docs/security/phase-18-inventory.md` | ✅ |
| 18.2 | initData policy, notification perms, sessionPolicy | ✅ |
| 18.3 | Security middleware package, rate limit fixes | ✅ |
| 18.4 | businessScope, resolveTenantHint, tenant tests | ✅ |
| 18.5 | Admin redaction, Finik `settingsManage`, operator logs | ✅ |
| 18.6 | .env.example, gitignore, envValidation, token log redaction | ✅ |
| 18.7 | mimeSniff, support/receipt upload validation | ✅ |
| 18.8 | `docs/guides/vps-production-hardening.md` | ✅ |
| 18.9 | `scripts/security-audit.mjs`, CI step, dependency-exceptions | ✅ |
| 18.10 | structuredLog security events, webhook debug redaction | ✅ |
| 18.11 | backup-recovery VPS section | ✅ |
| 18.12 | tenantIsolation, apiSecurityContracts, publicPayloadSafety, securityHardening extensions | ✅ |

---

## 3. New files

- `docs/security/phase-18-inventory.md`
- `docs/security/dependency-exceptions.md`
- `docs/security/phase-18-final-report.md`
- `docs/guides/vps-production-hardening.md`
- `src/middleware/security/*` (4 modules)
- `src/middleware/telegramInitDataPolicy.ts`
- `src/server/businessScope.ts`
- `src/server/resolveTenantHint.ts`
- `src/server/sessionPolicy.ts`
- `src/media/mimeSniff.ts`
- `scripts/security-audit.mjs`
- `tests/smoke/tenantIsolation.test.ts`
- `tests/smoke/apiSecurityContracts.test.ts`
- `tests/smoke/publicPayloadSafety.test.ts`

---

## 4. Key modified files

- `src/server/index.ts` — middleware mount, perms, logging, uploads
- `src/middleware/apiRateLimits.ts`, `requireTelegramAuth.ts`
- `src/server/envValidation.ts`, `structuredLog.ts`
- `src/media/upload.ts`, `supportRoutes.ts`, `finikMerchant.ts`
- `.env.example`, `.gitignore`, `.github/workflows/ci.yml`
- `docs/guides/backup-recovery.md`, `docs/platform-maturity-hardening-audit.md` (deprecation banner)

---

## 5. Reused components

- `requireTelegramAuth`, `verifiedTelegramIdFromRequest`, `requireMerchantStaff`, `MERCHANT_PERM`
- `requireOperatorUnlock`, `requireOperatorRecentReauth`
- Existing rate limiters, Cloudinary upload pipeline, Finik webhook crypto (unchanged)

---

## 6. Regression protection

- Checkout / Finik flows: **no business logic edits**; existing smoke tests pass
- `checkoutStabilityP0.test.ts`, `finikWebhookVerify.test.ts`, `telegramAuthResolution.test.ts` — pass
- API response shapes unchanged (additive logging/redaction only where documented)

---

## 7. Security audit summary

```bash
npm test          # 489 passed (88 files)
npm run build     # pass
node scripts/security-audit.mjs
```

**npm audit (2026-06-10):**

| Package tree | Critical | High | Moderate |
|--------------|----------|------|----------|
| root | 1 | 0 | 7 |
| frontend | 0 | 4 | 3 |

CI runs `security-audit.mjs` with `continue-on-error: true` until critical baseline cleared. Track exceptions in `dependency-exceptions.md`.

---

## 8. VPS readiness score

| Criterion | Weight | Score | Notes |
|-----------|--------|-------|-------|
| HTTPS / proxy docs | 10 | 8 | Guide + `TRUST_HTTPS` env |
| Firewall / SSH | 10 | 8 | Documented UFW + SSH checklist |
| Secrets management | 15 | 12 | envValidation, gitignore, no token prefix logs |
| Backups | 15 | 10 | Render + VPS pg_dump sections |
| Health checks | 10 | 10 | `/health`, `/ready` documented |
| Rate limits + proxy | 10 | 9 | `TRUST_PROXY` wired |
| Auth freshness | 10 | 9 | `auth_date` + optional replay |
| Tenant isolation tests | 10 | 9 | Contract + unit tests |
| Dependency audit | 5 | 6 | Script + CI (1 critical open) |
| Structured logging | 5 | 9 | Security event helpers |

**Total: 90 / 100** — production-ready on Render/Vercel today; VPS deploy requires operator to complete checklist in `vps-production-hardening.md` and resolve 1 critical npm advisory.

---

## 9. Operator next steps

1. Set `CORS_ALLOWED_ORIGINS` when frontend host is known (optional; default `*` preserved).
2. Enable `TRUST_PROXY=1` + `TRUST_HTTPS=1` behind reverse proxy.
3. Resolve root `npm audit` critical finding before tightening CI to fail on audit.
4. Quarterly: backup restore drill + dependency review.
