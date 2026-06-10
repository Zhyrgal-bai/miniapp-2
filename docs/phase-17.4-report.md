# ARCHA Phase 17.4 — Final Report

## 1. UX audit findings

**Merchant landing:** Empty feature icons, uneven section motion, mobile nav hiding anchors, no founder in nav, English eyebrows, footer without socials.

**Merchant showcase:** Tight spacing, triple Telegram CTA, missing hover/focus on contact pills, flat ARCHA footer attribution.

**Founder:** Instagram defaulted to `archa.kg`; generic social labels; FAQ founder copy mismatch.

**Errors:** Only store 404 was branded; `path="*"` showed shop-missing with indigo buttons; `AppErrorBoundary` unbranded; `storeNotFound` required `slugHint`.

**Loading:** No browser intro; boot spinner ignored reduced motion; register gate plain text loader.

**Brand drift:** Two greens (`#9dff57` vs `#22c55e`), FAQ slate/blue palette, `favicon2` vs unused `favicon.png`, register `logo.png` split.

---

## 2. Risks

| Risk | Mitigation |
|------|------------|
| Router `path="*"` breaks deep links | `/s/:slug` still routes to `App`; only unmatched paths use `NotFoundRoute` |
| Intro delays first impression | 1.8s cap, session cache, skipped in Telegram, ≤400ms with reduced motion |
| FAQ restyle affects store FAQ | Platform styles scoped to `.archa-faq--platform` / `MerchantFaqPage` |
| `App.tsx` regression | Only error UI branches changed; commerce gates untouched |

---

## 3. New files

- `frontend/src/components/branding/ArchaIntro.tsx`
- `frontend/src/components/branding/archaIntro.css`
- `frontend/src/components/errors/ArchaErrorShell.tsx`
- `frontend/src/components/errors/ArchaErrorPanel.tsx`
- `frontend/src/components/errors/errorCopy.ts`
- `frontend/src/components/errors/archaError.css`
- `frontend/src/pages/NotFoundRoute.tsx`
- `tests/smoke/archaPresentation174.test.ts`
- `docs/phase-17.4-report.md`

---

## 4. Modified files

- `frontend/src/config/brandAssets.ts`
- `frontend/src/config/founder.ts`
- `frontend/src/main.tsx`
- `frontend/src/App.tsx`
- `frontend/src/App.css`
- `frontend/src/components/ui/AppErrorBoundary.tsx`
- `frontend/src/components/storefront/runtime/StoreNotFoundScreen.tsx`
- `frontend/src/pages/MerchantDashboardPage.tsx`
- `frontend/src/pages/MerchantLandingPage.tsx` + `.css`
- `frontend/src/components/landing/FounderSection.tsx` + `.css`
- `frontend/src/pages/MerchantFaqPage.css`
- `frontend/src/components/faq/archaFaq.css`
- `frontend/src/pages/MerchantRegisterPage.tsx`
- `frontend/src/components/storefront/web/WebShowcaseFooter.tsx` + `webShowcase.css`
- `frontend/src/design/archaPremium.css`
- `frontend/index.html`
- `frontend/src/content/archaFaqContent.ts`
- `tests/smoke/founderConfig.test.ts`

---

## 5. 17.4A Intro

`ArchaIntro` — logo glow → subtle rotate/parallax → fade (1.8s). Session key `archa_intro_seen`. `useReducedMotion()` shortens to ~380ms. Wired in `MerchantDashboardPage` for browser landing only.

---

## 6. 17.4B Founder

Instagram default → `https://instagram.com/zhyrgal4_ik`, display handle `@zhyrgal4_ik`. Social pills show handles; improved spacing, touch targets, focus rings. FAQ founder copy aligned. Nav link `#founder` added on landing.

---

## 7. 17.4C Universal Errors

`ArchaErrorShell` + `errorCopy.ts` centralize ARCHA-green full-page errors. Migrated: `StoreNotFoundScreen`, `shop-missing`, `AppErrorBoundary`. `NotFoundRoute` for `path="*"`. `storeNotFound` shows shell without requiring `slugHint`.

---

## 8. 17.4D Landing

Hero kicker + clearer hierarchy. Feature icons per id. Why Telegram section. Step connector line. Pricing badge. Inline FAQ accordion. Footer with `logoIcon` + founder socials. Scroll-reveal on static sections. Russian eyebrows.

---

## 9. 17.4E Merchant Showcase

Increased spacing via `--sf-space-*`. Hover/focus on social pills. Footer: favicon + subtle `Telegram →` link. Text overflow fixes at 320px. Landscape cover adjustment.

---

## 10. 17.4F Branding

`archaPremium.css` Phase 17.4 tokens (`--archa-error-bg`, `--archa-btn-focus-ring`, etc.). Merchant FAQ → ARCHA green. Platform FAQ chips + support CTA use neon green. Register uses `logoMark` + `TenantBootScreen` gate loader.

---

## 11. 17.4G Logo System

Canonical: `/favicon.png` via `ARCHA_BRAND.favicon` and `logoIcon`. `index.html` updated. Zero code refs to `favicon2` / `logo.png`.

---

## 12. 17.4H Microinteractions

`:focus-visible` on `.archa-btn-*`, founder/landing FAQ triggers. Card hover lift on why-cards. Reduced motion on boot spinner, showcase hovers, FAQ transitions. Mobile nav horizontal scroll; error button stack; 44px touch targets.

---

## 13. What was reused

- `archaPremium.css` tokens, `.archa-glass`, `.archa-btn-*`
- `ARCHA_BRAND` registry
- Landing `fadeUp` / `heroStagger` framer-motion
- `StoreNotFoundScreen` export (wrapper)
- `FounderSection` + `ARCHA_FOUNDER` config
- `TenantBootScreen` (Telegram boot + register gate)
- Web showcase components (in-place polish)
- `ArchaFaqView` accordion structure

---

## 14. Regression protection

No server/API/checkout/CRM/marketing/analytics/subscription changes. `StorefrontRenderer` commerce gates untouched. Slug routing logic unchanged. SEO meta unchanged. Telegram-first: intro/landing polish browser-only.

---

## 15. npm test

```
Test Files  86 passed (86)
Tests       471 passed (471)
```

(includes `archaPresentation174.test.ts` + updated `founderConfig.test.ts`)

---

## 16. npm run build

```
✓ tsc -b && vite build — success
```

Frontend bundle built to `frontend/dist/`.

---

## Manual audit checklist

| Check | Status |
|-------|--------|
| Landing hero / features / pricing / FAQ / footer | Implemented |
| Founder `@zhyrgal4_ik` + photo fallback | Implemented |
| Intro first visit / session skip | Implemented |
| 404 `/nope`, `/s/bad-slug`, no-tenant | Implemented |
| Showcase spacing + CTA hierarchy | Implemented |
| Responsive 320 / 768 / 1024 | CSS coverage added |
| ARCHA green on all public errors | Implemented |
