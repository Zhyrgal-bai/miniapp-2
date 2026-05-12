# GET `/api/storefront/:businessId` — public response schema

Runtime validation uses **`safeParseStorefrontPublicApiResponse`** from [`src/storefront/storefrontPublicApiResponseSchema.ts`](../src/storefront/storefrontPublicApiResponseSchema.ts).

## Where it runs

| Layer | Behavior |
|-------|-----------|
| **Server** | After resolving categories / featured products, the handler validates the full JSON before [`setCachedStorefrontPayload`](../src/server/storefrontCache.ts) and `res.json`. Invalid payloads return **500** and are not cached. Cached rows are re-validated on read; failed cache entries trigger a rebuild. |
| **Client** | [`StorefrontPayloadContext.tsx`](../frontend/src/components/storefront/runtime/StorefrontPayloadContext.tsx) parses the axios response; on failure sets user-visible error and `payload = null`. |

## Type alignment

- [`ResolvedStorefrontPayload`](../src/storefront/schema.ts) now includes optional **`storeName`** so the wire object matches what the handler attaches after `resolveStorefrontConfig`.
- The Zod schema uses **`z.record`** for nested storefront config blobs on the wire (header/card/text/style) while sections remain strictly typed by `type` enum.

## Imports from the frontend

Vite alias **`@repo-storefront/*`** → `../src/storefront/*` ([`frontend/vite.config.ts`](../frontend/vite.config.ts)). The frontend depends on **`zod`** so the shared schema module bundles correctly.
