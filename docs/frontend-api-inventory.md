# Frontend API inventory (Stage 0)

Cross-reference of **all HTTP entry points** used by the Vite SPA under [`frontend/src`](../frontend/src) and where they are defined on the server ([`src/server/index.ts`](../src/server/index.ts) unless noted).

Legend: **T** = tenant header / `x-business-id` / `shop` query (see [`frontend/src/services/api.ts`](../frontend/src/services/api.ts)); **TG** = `x-telegram-init-data` (see [`telegramWebAppInitDataHeader`](../frontend/src/utils/telegramInitDataHeader.ts)); **Admin** = Telegram `userId` in query/body for legacy admin routes.

## Services layer ([`frontend/src/services`](../frontend/src/services))

| Module | Method | Path | Auth / notes |
|--------|--------|------|----------------|
| `api.ts` | — | `VITE_API_URL` → `API_BASE_URL` | Axios instance + `withTenantHeaders` for scoped paths |
| `storefrontBuilderApi.ts` | GET | `/api/merchant/storefront-builder` | T + merchant staff (server: `requireMerchantStaff`) |
| | PUT | `/api/merchant/storefront-builder/draft` | |
| | POST | `/api/merchant/storefront-builder/publish` | |
| | POST | `/api/merchant/storefront-builder/reset` | |
| `admin.service.ts` | GET | `/api/merchant/schemas` | `userId` query |
| | GET/POST/PUT/DELETE | `/products`, `/products/:id` | `userId` query/body |
| | GET | `/categories` (via `apiAbsoluteUrl`) | `userId` |
| | POST | `apiAbsoluteUrl("/categories")` | Admin POST pattern |
| | DELETE | `apiAbsoluteUrl("/categories/:id")` | |
| | GET | `/orders` | `adminGet` + `userId` |
| | POST | `/payment/list`, `/payment`, `/promo/list`, `/promo` | `adminPost` |
| | DELETE | `/payment/:id`, `/promo/:code` | `adminDelete` |
| | POST | `/analytics` | `adminPost` |
| | POST | `${API_BASE_URL}/upload` | multipart + T |
| | POST | `${API_BASE_URL}/products/upload-images` | multipart + T |
| | PUT | `${API_BASE_URL}/orders/:id` | JSON status/tracking + T |
| | DELETE | `${API_BASE_URL}/orders/clear` | |
| | GET | `/api/memberships` | `userId`, `shop` |
| | POST | `/api/memberships/update-role` | |
| `adminGate.store.ts` | GET | `${API_BASE_URL}/api/me` | `userId`, `shop` |
| `businessThemeApi.ts` | GET | `/api/business/:businessId` | T |
| | PUT | `/api/business/:businessId/theme` | T + query `shop`, `userId` |
| | PUT | `/api/business/template` | |
| `merchantDashboardApi.ts` | GET | `/my-businesses?telegramId=` | Public card list (server: `merchantDashboard` contract) |
| `myOrdersApi.ts` | GET | `/orders/my` | params + catalog shop |
| `platformApi.ts` | GET/POST | `/api/platform/my-businesses`, `/api/platform/store-settings`, `/api/platform/update-finik`, `/api/platform/register-request`, `/api/platform/check-webhook`, `/api/platform/toggle-bot` | TG header |
| `platformAdminApi.ts` | POST | `/api/platform/admin/approve`, `reject`, `disable`, `enable`, `unblock`, `purge-business`, `extend` | Platform admin |

## Storefront runtime

| Location | Method | Path | Notes |
|----------|--------|------|--------|
| [`StorefrontPayloadContext.tsx`](../frontend/src/components/storefront/runtime/StorefrontPayloadContext.tsx) | GET | `/api/storefront/:businessId` | T; validated with shared Zod ([`storefrontPublicApiResponseSchema.ts`](../src/storefront/storefrontPublicApiResponseSchema.ts), [doc](./storefront-public-api-schema.md)) |
| [`DiscoveryRails.tsx`](../frontend/src/components/storefront/discovery/DiscoveryRails.tsx) | GET | `/products` | Catalog |

## Builder

| Location | Method | Path |
|----------|--------|------|
| [`reusableBlocksApi.ts`](../frontend/src/builder/reusableBlocks/reusableBlocksApi.ts) | GET/POST/DELETE | `/api/merchant/reusable-blocks`, `/api/merchant/reusable-blocks/:id` |
| [`uploadImage.ts`](../frontend/src/builder/media/uploadImage.ts) | POST | `${API_BASE_URL}/upload` |

## Pages (direct `fetch` / `api`)

| Page | Path | Notes |
|------|------|--------|
| [`CheckoutPage.tsx`](../frontend/src/pages/CheckoutPage.tsx) | POST `apiAbsoluteUrl("/promo/apply")` | |
| | POST `/orders` | via `api.post` |
| | — | Nominatim OSM (external) |
| [`MyOrders.tsx`](../frontend/src/pages/MyOrders.tsx) | GET `/settings` + query | |
| | POST `/orders/:id/upload-receipt` | `apiAbsoluteUrl` |

## `admin.service.ts` legacy `adminPost` / `adminGet` paths

These resolve to **`API_BASE_URL` + path** (same origin as API): `/connect-bot`, `/payment`, `/promo`, `/orders`, `/analytics`, etc. Server must expose matching Express routes (see grep in `src/server/index.ts` for `/connect-bot`, `/orders`, `/payment`, `/promo`, `/analytics`).

## Gaps / drift to watch

- **Merchant pages** ([`MerchantRegisterPage`](../frontend/src/pages/MerchantRegisterPage.tsx), [`ConnectBotPage`](../frontend/src/pages/ConnectBotPage.tsx)) may call **`adminService.postConnectBot`** or platform APIs indirectly via parent components — no direct `fetch` in those two files; primary traffic is `platformApi` + `merchantDashboardApi` from [`PlatformPage`](../frontend/src/pages/PlatformPage.tsx).
- **GET `/api/storefront/:id`** response: server source of truth is [`resolveStorefrontConfig`](../src/storefront/schema.ts); includes `theme` and `featureFlags` (frontend TS type in `StorefrontRenderer.tsx` historically omitted them; runtime JSON includes them).

## Server alignment checklist

When adding or renaming routes, update:

1. This inventory  
2. [`frontend/src/services/api.ts`](../frontend/src/services/api.ts) `isTenantScopedPath` if path classification changes  
3. CORS / auth middleware on the server for new prefixes  

Last updated: implementation pass for greenfield roadmap Stage 0.
