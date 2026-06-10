# VPS Production Hardening

> **Audience:** Platform operator deploying ARCHA on a self-managed VPS  
> **Scope:** Documentation only — no deployment automation changes

---

## 1. Network layout

```
Internet → nginx/Caddy (443) → Node API (127.0.0.1:PORT)
         → static SPA (optional same host or Vercel)
```

- Terminate TLS at the reverse proxy (Let's Encrypt / certbot).
- Bind Node to `127.0.0.1` only; never expose the app port directly.
- Set `TRUST_PROXY=1` and `TRUST_HTTPS=1` in `.env` when TLS terminates at the proxy.

---

## 2. Firewall (UFW example)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

Deny direct access to the Node listen port (e.g. 3000/10000).

---

## 3. SSH hardening

- Disable password authentication (`PasswordAuthentication no`).
- Use SSH keys only; restrict `AllowUsers` to the deploy account.
- Consider fail2ban for `sshd` and nginx 4xx/5xx abuse patterns.

---

## 4. System updates

- Enable `unattended-upgrades` for security patches.
- Reboot during maintenance windows after kernel updates.

---

## 5. Secrets & environment

| Item | Requirement |
|------|-------------|
| `.env` file permissions | `chmod 600`, owned by deploy user |
| `BOT_TOKEN_SECRET_KEY` | ≥32 random chars |
| `TELEGRAM_WEBHOOK_SECRET` | Required in production |
| `OPERATOR_PASSWORD_HASH` | bcrypt hash; avoid `ADMIN_PANEL_PASSWORD` |
| `WEBHOOK_DEBUG` | Must be unset in production |
| `SKIP_TELEGRAM_WEBAPP_AUTH` | Forbidden in production |

Store operator secrets in 1Password/Vault; never commit `.env` or `frontend/.env`.

---

## 6. Health checks

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness — process up |
| `GET /ready` | Readiness — DB reachable |

Configure systemd or load balancer to use these paths.

---

## 7. systemd unit (example)

```ini
[Unit]
Description=ARCHA API
After=network.target postgresql.service

[Service]
Type=simple
User=archa
WorkingDirectory=/opt/archa
EnvironmentFile=/opt/archa/.env
ExecStart=/usr/bin/node scripts/productionStart.mjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## 8. ARCHA security features (Phase 18)

- Env-driven CORS (`CORS_ALLOWED_ORIGINS`, default `*`).
- HTTP security headers middleware.
- Telegram `auth_date` freshness + optional replay guard.
- Rate limits with `TRUST_PROXY` support.
- Tenant isolation helpers + smoke regression tests.
- Structured security logging (`auth_failure`, `rate_limit_hit`, `tenant_access_denied`, `operator_action`).

---

## 9. Pre-launch checklist

- [ ] HTTPS valid on API and Mini App URLs
- [ ] UFW / cloud security group: 22, 80, 443 only
- [ ] `.env` permissions 600
- [ ] `npm test` + `npm run build` pass on release commit
- [ ] `node scripts/security-audit.mjs` — no critical CVEs
- [ ] `/ready` returns `{ ok: true, db: true }`
- [ ] Backup cron configured (see `backup-recovery.md`)
- [ ] Operator unlock works with `OPERATOR_PASSWORD_HASH`

---

## Related docs

- [Backup & Recovery](./backup-recovery.md)
- [Phase 18 Security Inventory](../security/phase-18-inventory.md)
- Render/Vercel guides remain valid for managed hosting (`render.yaml`).
