# Finik Acquiring API — интеграция (Phase 3+)

> **Статус:** Phase 3 scaffold — router и адаптеры в коде; production checkout по-прежнему использует `finikMerchant.ts` (legacy HTTP напрямую).

## Endpoints

| Слой | URL |
|------|-----|
| Legacy create (текущий prod) | `{FINIK_API_BASE_URL}{FINIK_API_CREATE_PAYMENT_PATH}` — default `https://api.finik.kg/payments` |
| Official Acquiring beta (create) | `{FINIK_OFFICIAL_ACQUIRING_BASE_URL}{FINIK_OFFICIAL_ACQUIRING_CREATE_PATH}` — default `https://beta.api.acquiring.averspay.kg/v1/payment` |
| Official Acquiring beta (status) | `{FINIK_OFFICIAL_ACQUIRING_BASE_URL}{FINIK_OFFICIAL_ACQUIRING_STATUS_PATH}` — default `https://beta.api.acquiring.averspay.kg/v1/payment/{paymentId}` (GET, RSA) |
| Legacy status | `{FINIK_API_BASE_URL}{FINIK_API_GET_PAYMENT_PATH}` — default `https://api.finik.kg/payments/{id}` |

## Переменные окружения

| Variable | Default | Описание |
|----------|---------|----------|
| `FINIK_CREATE_API_MODE` | `legacy` | `legacy` \| `official` \| `auto` |
| `FINIK_OFFICIAL_ACQUIRING_BASE_URL` | `https://beta.api.acquiring.averspay.kg` | Beta host |
| `FINIK_OFFICIAL_ACQUIRING_CREATE_PATH` | `/v1/payment` | Create path |
| `FINIK_OFFICIAL_ACQUIRING_STATUS_PATH` | `/v1/payment/{paymentId}` | GET status (Phase 5-B; уточнить у Finik при расхождении) |
| `FINIK_API_GET_PAYMENT_PATH` | `/payments/{id}` | Legacy GET status |
| `FINIK_RSA_PRIVATE_KEY` | — | PEM для RSA (official, позже) |
| `FINIK_RSA_PRIVATE_KEY_PATH` | — | Путь к PEM |

### Режимы `FINIK_CREATE_API_MODE`

- **legacy** — только `LegacyCreateAdapter` (Bearer + `X-Api-Secret`). **Используйте в production.**
- **official** — маршрутизация в `OfficialAcquiringCreateAdapter` (scaffold: возвращает `finik_official_not_implemented`).
- **auto** — official только если задан `FINIK_RSA_PRIVATE_KEY` (или `_PATH`); иначе legacy. После реализации RSA official станет активным при наличии ключа.

## Код

| Модуль | Назначение |
|--------|------------|
| `src/server/finik/finikCreateTypes.ts` | `FinikCreatePort`, контекст, результат |
| `src/server/finik/legacyCreateAdapter.ts` | Legacy HTTP create |
| `src/server/finik/officialAcquiringCreateAdapter.ts` | Official RSA create (`POST /v1/payment`) |
| `src/server/finik/finikRsaSigning.ts` | RSA-SHA256 via `@mancho.devs/authorizer` |
| `src/server/finik/finikCreateRouter.ts` | `createFinikPaymentSession()` |
| `src/server/finik/finikStatusRouter.ts` | `fetchFinikPaymentStatusRouted()` — legacy / official / auto |
| `src/server/finik/officialAcquiringStatusAdapter.ts` | Official GET + RSA |
| `src/server/finik/legacyStatusAdapter.ts` | Legacy GET + Secret |
| `src/server/finik/finikCreateResponseNormalizer.ts` | Поля ответа legacy / official |
| `src/server/finik/finikCreateLogging.ts` | Structured logs |

## Логи

- `finik_create_attempt` — выбор адаптера
- `finik_create_result` — итог
- `finik_create_http_error` — HTTP ошибка legacy
- `finik_official_create_skipped` — official scaffold не вызывает API

## Correlation (не менять без ADR)

| Flow | `external_id` |
|------|----------------|
| Storefront order | `{businessId}:{orderId}` |
| SaaS subscription | `saas_sub:{subscriptionPaymentRowId}` |
| Reservation deposit | см. `reservationDepositExternalId` |

## Открытые вопросы к Finik

1. Canonical RSA string для `POST /payment`
2. Поля request/response JSON
3. ID в webhook vs create response; canonical GET status path у Finik
4. Формат суммы (KGS)
5. Idempotency
6. Один platform RSA key для нескольких `accountId`

## Webhook

Phase 4: webhook `POST /finik/webhook/:businessId` — legacy HMAC (`finikSecret`) **или** official RSA (`FINIK_PUBLIC_KEY`, заголовки `signature` + `x-api-timestamp`). Парсинг `paymentId` / `payment_id` / `transactionId` / `id`. `RedirectUrl` → витрина `?view=my-orders`.
