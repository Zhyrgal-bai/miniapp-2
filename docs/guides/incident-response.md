# Incident Response Guide

> **Audience:** Operator + engineering  
> **Goal:** Handle incidents without founder inventing steps under pressure.

---

## 1. Severity levels

| Level | Examples | Response target |
|-------|----------|-----------------|
| **S0** | API down, all checkouts fail, data breach suspected | 15 min acknowledge; all-hands |
| **S1** | Finik broken for many shops, webhooks mass fail | 1 h mitigate |
| **S2** | Single merchant checkout, UI bug with workaround | 24 h |
| **S3** | Cosmetic, single user | Backlog |

---

## 2. First 15 minutes (any S0/S1)

1. **Confirm** — check `/health`, `/ready`, Render status  
2. **Communicate** — note in operator channel: severity, symptoms, time  
3. **Mitigate** — rollback deploy OR disable feature flag OR scale service  
4. **Assign** — one incident commander (founder or engineering)  

---

## 3. Playbooks

### API unavailable (503 / timeout)

1. Render Dashboard → Logs → last deploy time  
2. `GET /ready` — if `db: false` → database issue  
3. If after deploy → **rollback** to previous commit (see release checklist)  
4. If migration error → check `productionStart.mjs` logs; do not re-deploy blindly  

### Database connection failures

1. Verify Render Postgres status  
2. Check `DATABASE_URL` / connection limit  
3. Restart web service once  
4. If persistent → Render support + restore from backup plan  

### Telegram webhooks mass failure

1. Verify `TELEGRAM_WEBHOOK_SECRET` unchanged  
2. Check Render URL / SSL  
3. Operator: re-check webhook on 2–3 shops  
4. See runbook: `docs/guides/operator-runbook.md`  

### Finik payments failing

1. Check `FINIK_WEBHOOK_SIGNATURE_HEADER` env  
2. Verify merchant Finik keys in settings  
3. Test one payment on staging (when available)  
4. Merchant comms: “Платежи временно недоступны, работаем над восстановлением”  

### Bad deploy (features broken, API up)

1. Identify deploy SHA  
2. Revert Render + Vercel to previous SHA  
3. Verify smoke: `/health`, `/merchant`, one storefront  
4. Post-incident note required  

### Suspected security incident

1. **Do not** delete logs  
2. Disable `SKIP_TELEGRAM_WEBAPP_AUTH` if ever set  
3. Rotate `OPERATOR_PASSWORD_HASH`, `TELEGRAM_WEBHOOK_SECRET`, `BOT_TOKEN_SECRET_KEY` if tokens exposed  
4. Document scope: which routes, which data  
5. Founder + engineering only until contained  

---

## 4. Rollback procedure

1. Git: identify last good commit/tag  
2. Render: deploy previous commit  
3. Vercel: promote previous deployment  
4. If migration was destructive → DB restore from backup (Render dashboard)  
5. Verify `/health` + merchant smoke  
6. Write post-incident note  

Full checklist: [release-checklist.md](../release-checklist.md) § Rollback.

---

## 5. Communication templates

### Merchant-facing (S0/S1)

> Мы наблюдаем техническую проблему на платформе ARCHA. Команда уже работает над восстановлением. Ориентировочное время обновления — в течение [X] часов. Приносим извинения за неудобства.

### Resolved

> Проблема устранена. Если ошибка повторится — напишите в поддержку через админку магазина.

---

## 6. Post-incident template

Save as `docs/incidents/YYYY-MM-DD-short-title.md`:

```markdown
## Summary
## Severity / duration
## Impact (merchants, orders, data)
## Timeline
## Root cause
## Mitigation
## Permanent fix
## Action items
```

---

## 7. Prevention

| Practice | Frequency |
|----------|-----------|
| Staging smoke before prod | Every release |
| Backup restore test | Quarterly |
| `/health` uptime monitor | Always |
| Review 5xx logs | Daily during beta |

---

## Related docs

- [Operator Runbook](./operator-runbook.md)
- [Product Operating Model](../product-operating-model.md)
- [Release Checklist](../release-checklist.md)
