# Operator Runbook

Руководство для операторов платформы (approve, support, beta).

## Доступ

1. Откройте `/merchant` из Telegram Mini App
2. **Operator mode** → введите пароль (`OPERATOR_PASSWORD_HASH` в env)
3. Сессия действует 15–30 мин; для опасных действий — повторный пароль

## Ежедневные / еженедельные задачи

### Понедельник — ops ritual (30 мин)

1. `GET /api/platform/admin/funnel/summary?days=7` — где отваливаются мерчанты  
2. `GET /api/platform/admin/feedback` — triage open → triaged  
3. Обновить [`docs/roadmap.md`](../roadmap.md) если нужно  
4. Проверить Render logs на повторяющиеся 5xx  

См. [`docs/product-operating-model.md`](../product-operating-model.md)

### Заявки на регистрацию

- `GET /api/platform/admin/requests` или UI в operator panel
- **Approve** → создаёт Business + trial
- **Reject** → отклонить с причиной (Telegram уведомление)

**SLA:** ответ в течение 48 часов.

### Мониторинг beta

| Endpoint | Что смотреть |
|----------|--------------|
| `GET /api/platform/admin/funnel/summary?days=7` | Где отваливаются мерчанты |
| `GET /api/platform/admin/feedback` | Баги и UX от beta |

### Блокировка магазина

- **Block** — полный бан (`isBlocked`)
- **Disable** — временно выключить (`isActive=false`)
- **Unblock** — снять бан после разбора

## Beta-программа

1. После approve пометьте магазин: `Business.featureFlags.betaCohort = "2026-q2"`
2. Еженедельно: funnel summary + feedback review
3. Критические баги — hotfix до расширения cohort

## Deploy (оператор → инженер)

См. [`docs/release-checklist.md`](../release-checklist.md) и [`docs/reviews/release-review.md`](../reviews/release-review.md)

Governance и roadmap: [`docs/product-governance.md`](../product-governance.md)

После деплоя проверить:
- `/health`, `/ready`
- Approve test request на staging (если есть)
- Webhook status у 2–3 beta-магазинов

## Инциденты

См. [`docs/guides/incident-response.md`](incident-response.md) — severity S0–S3, rollback, шаблоны.

| Симптом | Действие |
|---------|----------|
| API 503 | Render logs; проверить `/ready` |
| Webhook mass fail | `TELEGRAM_WEBHOOK_SECRET`, перезапуск ботов |
| Finik payments fail | Signature header, merchant Finik keys |
| DB migration fail | `productionStart.mjs` logs; `prisma migrate status` |

## Контакты и эскалация

- Логи: Render Dashboard → Service → Logs
- Feedback merchants: `/api/platform/admin/feedback`
- Architecture docs: `docs/` folder

## Метрики успеха beta

- Registration → approve < 48h
- 80% approved merchants add first product in 7d
- 30% get first order in 14d
- < 3 support tickets per merchant in month 1
