# Platform Brand Audit

> **Phase:** PLATFORM BRAND + MARKET DOMINANCE — Step 0  
> **Goal:** Understand current identity fragmentation and define a single Telegram-native commerce brand.

---

## 1. Executive summary

The product **works as a platform** but **reads as a collection of surfaces**. Merchants see **ARCHA** in the cabinet; buyers see **Shop** / **Магазин**; operators see generic **Админ**; docs refer to “Mini App store” / “platform”.

**Verdict:** Brand maturity is **~25%**. Technical foundation is strong; identity layer is inconsistent and blocks ecosystem dominance.

**Recommended direction:** Consolidate on **ARCHA** as the platform brand (already present in merchant UX) with a clear positioning line and unified token system across all surfaces.

---

## 2. Current state inventory

### 2.1 Naming fragmentation

| Surface | Current name | Source |
|---------|--------------|--------|
| Merchant cabinet header | **ARCHA** | `ArchaHeader.tsx` |
| Merchant register | **ARCHA** | `MerchantRegisterPage.tsx` |
| Storefront header (default) | **Shop** | `brand.ts` → `VITE_APP_NAME` |
| HTML document title | **Магазин** | `index.html` |
| Admin panel | **Админ** | `AdminLayout.tsx` |
| Discover / marketplace | **Маркетплейс** (generic) | `DiscoverPage.tsx` |
| Docs / architecture | “platform”, “Mini App builder” | various `.md` files |

**Problem:** No single `platformIdentity` module. Three parallel naming paths (`ARCHA` hardcoded, `VITE_APP_NAME`, per-merchant store name).

### 2.2 Visual identity

| Element | Status | Notes |
|---------|--------|-------|
| Logo | Partial | Single JPG reused (`674440574_…jpg`) — not a logo system |
| Color | Partial | `archaUi.ts` — dark slate + emerald merchant chrome |
| Typography | Weak | System fonts; no platform type scale |
| Motion | Partial | Framer Motion on PlatformPage; inconsistent elsewhere |
| Storefront themes | Strong | Per-merchant `themeConfig` / tokensV3 — **not** platform-branded |
| Favicon | Generic | `/favicon.svg` — not ARCHA-branded |

### 2.3 Tone of voice

| Context | Current tone | Gap |
|---------|--------------|-----|
| Onboarding | Friendly, emoji-heavy | Good start; not tied to brand personality |
| Errors | Technical Russian | Needs consistent “support personality” |
| Admin ops | Operator-neutral | OK for internal; lacks platform voice in merchant-facing ops |
| Discover | Functional | No “ecosystem” narrative |

### 2.4 Personality gaps

- **Onboarding personality:** Step-based wizard exists but says “Telegram-магазин”, not “ARCHA ecosystem”.
- **Support personality:** Tickets work; no branded help center / academy voice.
- **Trust personality:** No verified badges, no “secured by ARCHA” layer on checkout.

---

## 3. Competitive positioning (strategic frame)

| Alternative mental model | Why merchants leave |
|--------------------------|---------------------|
| “Bot builder” | Commodity, no network, no growth |
| “White-label shop” | Isolation, no discovery |
| “Payment plugin” | Single feature, easy to replace |

**Target mental model:**

> **ARCHA** — mobile commerce operating system inside Telegram.  
> Your store is yours; the network, discovery, growth, and trust layer is shared.

**Positioning statement (draft):**

> ARCHA помогает merchants продавать в Telegram с витриной уровня приложения, аналитикой роста и доступом к экосистеме покупателей — без разработки и без “острова” вне сети.

---

## 4. Brand architecture (naming system)

```
ARCHA                          ← Platform brand (SaaS, marketplace, docs, landing)
├── ARCHA Commerce             ← Product category label (optional sub-brand)
├── ARCHA for Merchants        ← Merchant-facing line
├── ARCHA Discover             ← Public marketplace / explore
└── [Merchant Store Name]      ← Tenant brand (never overridden)
```

### Naming rules

| Layer | Rule | Example |
|-------|------|---------|
| Platform | Always **ARCHA** in merchant cabinet, landing, billing, support | “ARCHA — ваш кабинет” |
| Storefront | Merchant’s own name; powered-by line optional on free tier | “Archa Store” (merchant) / “Powered by ARCHA” |
| Features | Verb + ARCHA only for platform-native features | “ARCHA Discover”, “ARCHA Growth” |
| Internal | Operator tools stay neutral | “Operator Mode”, “Админ” |

### Tagline candidates (pick one in Phase 1 branding)

1. **Commerce OS для Telegram** — technical, differentiated  
2. **Магазины, которые растут вместе** — ecosystem, merchant-friendly  
3. **Продавайте там, где живут ваши клиенты** — buyer-centric  

**Recommendation:** Primary **#1**, secondary merchant line **#2**.

---

## 5. Visual language (target)

Build on existing merchant dark UI (`archaUi.ts`); extend to full token set.

### Color philosophy

| Token role | Direction |
|------------|-----------|
| Platform base | Deep slate (`#0B0F14` family) — premium, not “bot cheap” |
| Primary action | Emerald (`#10B981` family) — growth, commerce, Telegram-adjacent |
| Accent | Soft violet or amber **only** for marketplace/discover — separates “network” from “my store” |
| Merchant storefront | Tenant-controlled; platform never forces ARCHA colors on buyer UI |

### Typography identity

| Use | Font strategy |
|-----|---------------|
| Platform UI | Inter or Manrope — clean SaaS |
| Storefront | Tenant theme system (existing) |
| Marketing / landing | Display weight for hero; same family as platform |

### Motion language

| Pattern | Use |
|---------|-----|
| Sheet rise + spring | Modals, onboarding (already on PlatformPage) |
| Stagger list | Store cards, discover rails |
| Micro haptic | Telegram MainButton actions |
| **Avoid** | Bouncy/playful motion on checkout or payment |

---

## 6. Surface-by-surface brand checklist

| Surface | Priority | Action |
|---------|----------|--------|
| `platformIdentity.ts` (new) | P0 | Single config: name, tagline, colors, support email |
| PlatformPage / onboarding | P0 | Replace hardcoded ARCHA strings |
| index.html / PWA manifest | P0 | Title, theme-color, description |
| DiscoverPage | P1 | ARCHA Discover branding + ecosystem copy |
| Admin chrome | P1 | “ARCHA Admin” subtitle, not generic “Админ” |
| Landing (future) | P1 | Full marketing site |
| Email / billing receipts | P2 | Branded templates |
| Storefront powered-by | P2 | Plan-gated or always-on free tier |

---

## 7. Brand maturity scorecard

| Dimension | Score (0–5) | Target Phase 1 |
|-----------|-------------|----------------|
| Naming consistency | 2 | 5 |
| Visual system | 2 | 4 |
| Motion consistency | 3 | 4 |
| Tone of voice | 2 | 4 |
| Trust / social proof | 1 | 3 |
| Marketing assets | 0 | 3 |
| Landing ecosystem | 0 | 3 |

---

## 8. Phase 1 branding deliverables (after this audit)

1. **`frontend/src/config/platformIdentity.ts`** — canonical constants + env overrides  
2. **Logo system** — icon mark + wordmark (SVG), not single JPG  
3. **Platform token CSS** — `data-surface="platform"` scope (extends greenfield UI Stage 1)  
4. **Copy pass** — onboarding, discover, errors, empty states  
5. **OG / share metadata** — for `/discover`, `/merchant`, landing  

---

## 9. Non-goals (this phase)

- Rebrand every merchant storefront to ARCHA look  
- Full marketing site before marketplace trust layer  
- Custom font licensing before token consolidation  

---

## Related docs

- [Platform Brand + Market Dominance (master)](./platform-brand-market-dominance.md)
- [Greenfield UI tokens](./greenfield-ui-stage1-tokens.md)
- [Business Growth expansion](./business-growth-platform-expansion.md)
