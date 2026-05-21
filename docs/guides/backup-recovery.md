# Backup & Recovery

> **Audience:** Platform operator  
> **Stack:** Render PostgreSQL + Render Web + Vercel frontend

---

## 1. Automatic backups (Render Postgres)

Render provides **daily automatic backups** on paid Postgres plans. Free tier: verify plan limits in Render Dashboard.

**Before production launch:**

1. Render Dashboard → Postgres → **Backups**
2. Confirm backup schedule is enabled
3. Note retention period
4. Run one **manual backup** before first major migration

---

## 2. Restore procedure

### Full database restore

1. Render Dashboard → Postgres → Backups → select point-in-time
2. **Restore to new instance** (recommended) or in-place restore
3. Update `DATABASE_URL` on web service if instance changed
4. Redeploy API: `npm start` runs migrations via `productionStart.mjs`
5. Verify:
   - `GET /ready` → `{ ok: true, db: true }`
   - `GET /api/platform/admin/ops-summary` (operator unlocked)
   - One storefront smoke test

### Partial recovery (single merchant)

Use platform admin tools — do **not** restore full DB for one shop unless necessary:

- Disable store: `POST /api/platform/admin/disable`
- Purge test data: `POST /api/platform/admin/purge-business` (destructive, requires reauth)

---

## 3. Application rollback (no DB change)

When deploy broke code but migrations are safe:

1. Git: identify last good commit SHA
2. **Render:** Manual Deploy → previous commit
3. **Vercel:** Deployments → Promote previous build
4. Verify `/health`, `/ready`, `/merchant`, one storefront checkout start

If migration was applied and is **irreversible** — do not rollback code alone; restore DB or forward-fix migration.

---

## 4. Migration safety

Production start sequence (`scripts/productionStart.mjs`):

1. Baseline repair SQL (idempotent)
2. `prisma migrate deploy`
3. Optional one-off backfills (env-gated, Render-only)

**Rules:**

- Never use `prisma migrate reset` on production
- Never set `RESET_PUBLIC_SCHEMA=1` except intentional disaster recovery on Render
- Test migrations on staging DB clone first

---

## 5. Emergency contacts checklist

| Asset | Where stored |
|-------|----------------|
| Render account access | Founder / ops |
| Vercel project access | Founder / ops |
| `BOT_TOKEN_SECRET_KEY` | Render env (rotate if leaked) |
| `OPERATOR_PASSWORD_HASH` | Render env |
| Finik merchant keys | Per-business in DB |
| Domain DNS | Registrar |

---

## 6. Recovery test (quarterly)

- [ ] Restore staging DB from backup to test instance
- [ ] Point staging API at restored DB
- [ ] Run smoke tests from `docs/qa-production-checklist.md`
- [ ] Document time-to-recover (RTO) and data loss window (RPO)

---

## 7. Structured log search during incidents

Search Render logs for JSON events:

| Event | Meaning |
|-------|---------|
| `payment_failure` | Finik / amount mismatch |
| `webhook_reject` | Invalid signature |
| `inventory_reserve_failed` | Oversell attempt blocked |
| `inventory_mismatch` | Admin catalog vs ProductStock drift |
| `auth_reject` | Spoofed or missing initData |
| `stale_order_released` | Abandoned checkout cleanup |

Operator health: `GET /api/platform/admin/ops-summary`
