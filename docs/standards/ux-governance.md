# UX Governance

> **Purpose:** One product feel across storefront, platform, admin, checkout — aligned with [platform-vision.md](../platform-vision.md).

---

## 1. UX principles

| # | Principle | Test |
|---|-----------|------|
| 1 | **Mobile first** | Usable one-handed in Telegram WebView |
| 2 | **One primary action** | Each screen has obvious next step |
| 3 | **Speed feels premium** | Skeleton > spinner > blank |
| 4 | **Errors recover** | Say what happened + what to do |
| 5 | **Merchant ≠ buyer** | Admin complexity hidden from storefront |
| 6 | **Telegram native** | Safe areas, MainButton, BackButton |
| 7 | **Consistency > novelty** | Reuse patterns before inventing |

---

## 2. Commerce design rules

### Storefront (buyer)

| Rule | Spec |
|------|------|
| Product grid | Image-first cards; price visible |
| Product detail | Sheet from bottom; scroll lock |
| CTA hierarchy | One primary “Купить / В корзину” |
| Trust | Identity band, delivery/payment hints |
| Discovery rails | Max 8 items horizontal scroll |

### Catalog

| Rule | Spec |
|------|------|
| Empty category | Illustration + link to home |
| Search | Debounced; clear empty state |
| Filters | Collapsible on mobile |

---

## 3. Spacing rules

| Token use | Guideline |
|-----------|-----------|
| Page padding | 16px min; safe-area aware |
| Section gap | 24–32px between major blocks |
| Card internal | 12–16px |
| Touch targets | **44px min** height |
| Sticky elements | Respect `env(safe-area-inset-bottom)` |

**Platform/admin:** Match `archaUi` spacing — don’t mix random Tailwind scales on same screen.

---

## 4. Motion rules

| Context | Motion |
|---------|--------|
| Sheet open/close | Spring, 250–350ms |
| List enter | Stagger 30–50ms per item |
| Page transition | Fade or subtle Y — no flash |
| Checkout / payment | **Minimal** — stability > delight |
| Reduced motion | Respect `prefers-reduced-motion` |

**Avoid:** Bounce, excessive parallax, blocking animations on critical paths.

---

## 5. Onboarding rules (merchant)

| Rule | Detail |
|------|--------|
| Steps | Max 3 before action |
| Copy | Short sentences; one idea per line |
| Progress | Show what’s left (readiness score) |
| Skip | Allow dismiss after first visit |
| Success | Clear “what’s next” after register |

**Never:** Raw Telegram IDs, internal slugs in merchant-facing errors.

---

## 6. Checkout rules

| Rule | Detail |
|------|--------|
| Steps | Minimize fields; TG user prefill where possible |
| Validation | Inline under field |
| Payment wait | Single polling owner; visible status |
| Failure | Retry + support path — no alert() |
| Confirmation | Order number + next steps |

---

## 7. Support UX rules

| Rule | Detail |
|------|--------|
| Ticket create | Category + message minimum |
| Status visible | Merchant and buyer see state |
| Reply expectation | Show SLA (“ответ в течение 48 ч”) |
| Feedback form | On PlatformPage — short, optional contact |

---

## 8. Admin UX rules

| Rule | Detail |
|------|--------|
| Density | Mobile-usable tables → cards on narrow |
| Destructive actions | Confirm + permission gate |
| Loading | KPI skeletons on dashboard |
| Growth tab | Actionable tips > raw numbers |
| Design editor | Human labels — never raw product IDs in UI |

---

## 9. Consistency pass schedule

| Month | Surface |
|-------|---------|
| 1 | Checkout + payment |
| 2 | PlatformPage + onboarding |
| 3 | Admin orders + analytics |
| 4 | Discover + storefront home |

Each pass: spacing, motion, errors, empty states only — **no layout rewrite**.

---

## 10. UX review checklist (before ship)

- [ ] Works in Telegram iOS + Android WebView  
- [ ] Safe areas respected  
- [ ] Primary action obvious  
- [ ] No `alert()`  
- [ ] No raw IDs in user copy  
- [ ] Loading + empty + error states  
- [ ] Matches vision pillars  

---

## Related docs

- [Platform Vision](../platform-vision.md)
- [Platform Standards](./platform-standards.md)
- [Greenfield UI Stage 1](../greenfield-ui-stage1-tokens.md)
