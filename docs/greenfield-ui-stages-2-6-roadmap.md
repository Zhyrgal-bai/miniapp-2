# Stages 2–6 — Parity checklists and feature-flag strategy

Companion to the greenfield roadmap: **what to prove** before deleting legacy UI, and how to ship incrementally.

Related: [Stage 1 token plan](./greenfield-ui-stage1-tokens.md), [API inventory](./frontend-api-inventory.md), [Storefront Zod contract](./storefront-public-api-schema.md).

## Feature-flag strategy

| Flag | Suggested name | Scope |
|------|----------------|--------|
| Dev-only shell | `import.meta.env.DEV` + route `/__ui/...` | Stage 1 token shell without affecting users |
| Opt-in preview | `VITE_UI_V2=1` | Build-time: include new route tree + lazy chunks |
| Runtime toggle | `sessionStorage.setItem("ui_v2", "1")` or query `?ui_v2=1` | QA inside Telegram without separate build |
| Per-surface | `localStorage` **avoid** in Mini App (ephemeral WebViews) — prefer **query param** persisted via `sessionStorage` for the session |

**Routing:** mount new surfaces under parallel paths first (`/v2`, `/app/*`), then swap `RootAppOrPlatform` / `App` default once parity signed off.

**Bundle:** lazy-load `surfaces/storefront` and `surfaces/admin` with `React.lazy` so merchant-only users do not pay for admin v2.

---

## Stage 2 — Storefront foundation

**Parity checklist**

- [ ] `GET /api/storefront/:id` renders through new `SectionStack` (even if only placeholder sections).
- [ ] Header + footer from payload (`storefrontHeaderConfig`, footer section) match current behavior for **one** template (e.g. `dark`).
- [ ] Error / loading states for payload failure.
- [ ] No regression on `x-business-id` / `shop` resolution ([`ShopContext`](../frontend/src/context/ShopContext.tsx)).

**Exit:** Home path with new shell only behind flag; Lighthouse / manual scroll in Telegram OK.

---

## Stage 3 — Catalog, cards, cart

**Parity checklist**

- [ ] Product grid / discovery: `/products` + featured payload from storefront.
- [ ] [`ProductDetailModal`](../frontend/src/components/product/ProductDetailModal.tsx) flows (or replacement) — add to cart, variants.
- [ ] [`useCartStore`](../frontend/src/store/useCartStore.ts) unchanged API surface (Zustand actions).
- [ ] [`CartPage`](../frontend/src/pages/CartPage.tsx) / [`StickyCartBar`](../frontend/src/components/storefront/cart/StickyCartBar.tsx) / [`CheckoutPage`](../frontend/src/pages/CheckoutPage.tsx): `/orders`, `/promo/apply`, payment redirect.
- [ ] Receipt upload path [`MyOrders`](../frontend/src/pages/MyOrders.tsx) `/orders/:id/upload-receipt`.

**Exit:** End-to-end order in Telegram on v2 path.

---

## Stage 4 — Admin / dashboard

**Parity checklist**

- [ ] [`GET /api/me`](../frontend/src/store/adminGate.store.ts) gate unchanged (OWNER/ADMIN).
- [ ] Hash routes [`AdminApp`](../frontend/src/pages/admin/AdminApp.tsx) or explicit paths — product decision frozen in Stage 4 PR.
- [ ] All [`admin.service.ts`](../frontend/src/services/admin.service.ts) flows used by current pages: orders, products, categories, analytics, payment, promo, memberships.
- [ ] Uploads: `/upload`, `/products/upload-images`.

**Exit:** Merchant can run shop **only** from v2 admin for 24h dogfood.

---

## Stage 5 — Design studio

**Parity checklist**

- [ ] Theme persistence: [`businessThemeApi`](../frontend/src/services/businessThemeApi.ts) (`PUT` theme + template).
- [ ] Preview matches storefront renderer (same `resolveStorefrontLayoutVars` / token pipeline as Stage 1).
- [ ] No second copy of preset colors in frontend if server is SoT ([`themePresets.ts`](../frontend/src/builder/themePresets.ts) audit).

**Exit:** Change template + colors → publish → customer v2 reflects change.

---

## Stage 6 — Builder / custom sections

**Parity checklist**

- [ ] [`storefrontBuilderApi`](../frontend/src/services/storefrontBuilderApi.ts): GET/PUT draft, publish, reset.
- [ ] [`reusableBlocksApi`](../frontend/src/builder/reusableBlocks/reusableBlocksApi.ts).
- [ ] Section types from [`src/storefront/schema.ts`](../src/storefront/schema.ts) — no ad-hoc section IDs client-side.
- [ ] CDN image upload from builder ([`uploadImage.ts`](../frontend/src/builder/media/uploadImage.ts)).

**Exit:** New merchant can configure shop end-to-end without legacy builder routes.

---

## Order of deletion (after all stages green)

1. Legacy `components/ui/*.css` consumers removed.
2. `App.tsx` state-machine pages replaced by router-based v2.
3. Old `ThemeContext` DOM effects removed (per Stage 1 doc).
4. Builder folder `builder/*` legacy UI removed after v2 builder ships.
