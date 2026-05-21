# Production Release Checklist

Use before every production deploy and before beta exit.

## Pre-deploy

- [ ] `npm run predeploy` passes (check + smoke + prisma validate)
- [ ] All new migrations committed under `prisma/migrations/`
- [ ] `.env` secrets documented in `.env.example` (no secrets in git)
- [ ] `VITE_API_URL` on Vercel points to Render API URL
- [ ] `FRONT_URL` on Render points to Vercel URL

## Render (API)

- [ ] `DATABASE_URL` set with SSL
- [ ] `BOT_TOKEN_SECRET_KEY` ≥ 32 chars
- [ ] `TELEGRAM_WEBHOOK_SECRET` set
- [ ] `OPERATOR_PASSWORD_HASH` set (bcrypt)
- [ ] `SKIP_TELEGRAM_WEBAPP_AUTH` is **not** `1`
- [ ] `TELEGRAM_INIT_DEBUG` is **not** `1` (unless actively debugging)
- [ ] `FINIK_WEBHOOK_SIGNATURE_HEADER` configured if using Finik
- [ ] Deploy triggered → build succeeds
- [ ] `npx prisma migrate deploy` runs in start script (automatic via `productionStart.mjs`)
- [ ] `GET https://<api>/health` → `{ ok: true }`
- [ ] `GET https://<api>/ready` → `{ ok: true, db: true, envOk: true }`
- [ ] Render health check uses `/ready` (DB + env sanity)

## Vercel (frontend)

- [ ] Build succeeds
- [ ] `VITE_API_URL` correct for production
- [ ] Open `/merchant` in Telegram — platform loads
- [ ] Open `/s/<slug>` — storefront loads

## Smoke tests (15 min)

- [ ] New user: `/merchant` → registration form submits
- [ ] Operator: approve pending request
- [ ] Merchant: add product, publish design
- [ ] Shopper: browse, add to cart, checkout start
- [ ] Finik test payment (or manual payment flow)
- [ ] Merchant: see order notification
- [ ] Support: create ticket + merchant reply

## Post-deploy monitoring (24h)

- [ ] Render logs — no repeated 5xx
- [ ] No `FATAL` env validation errors on boot
- [ ] Webhook OK on platform dashboard
- [ ] Review `GET /api/platform/admin/ops-summary` (operator unlocked)
- [ ] Review `GET /api/platform/admin/funnel/summary` for events ingesting
- [ ] Search logs for JSON events: `payment_failure`, `webhook_reject`, `inventory_mismatch`
- [ ] Review feedback if any submitted

## Backup & recovery

See **`docs/guides/backup-recovery.md`** — confirm Render Postgres backups enabled before first production traffic.

## Rollback

1. Revert to previous git commit on Render + Vercel
2. If migration was applied and is irreversible — restore DB backup (Render dashboard)
3. Verify `/health` and smoke test #1

## Beta exit criteria

- [ ] 10+ active merchants with published storefronts
- [ ] 50+ completed orders
- [ ] 0 open P0 bugs
- [ ] Security hardening Phase 1 complete (unified auth)
- [ ] Mobile QA passed iOS + Android (see maturity audit)
