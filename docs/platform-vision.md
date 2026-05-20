# Platform Vision

> **Core identity:** what ARCHA is — and what it is **not**.  
> **Use:** Every feature, UX change, and partnership decision must pass this filter.

---

## One sentence

**ARCHA is a Telegram-native, mobile-first commerce operating system** — merchants get premium storefronts and SaaS operations; buyers get app-quality shopping inside Telegram.

---

## Non-negotiable pillars

| Pillar | Meaning | Implication |
|--------|---------|-------------|
| **Telegram-native** | Primary surface is Mini App + bots | No desktop-first admin; respect initData, MainButton, safe areas |
| **Mobile-first** | Thumb reach, fast load, vertical scroll | No dense tables on merchant mobile; 44px touch targets |
| **Storefront-first** | Buyer experience is the product | Merchant tools serve conversion, not feature count |
| **Merchant simplicity** | Solo seller can launch in 1 day | Progressive complexity; smart defaults |
| **Premium UX** | Feels like an app, not a “bot page” | Motion, spacing, no raw IDs/alerts in user paths |
| **SaaS operations** | Trial, billing, support, growth built-in | Platform owns merchant lifecycle |

---

## We optimize for

1. **Merchant retention** — they earn and stay  
2. **Buyer conversion** — fast browse → checkout  
3. **Ecosystem discovery** — stores find audiences through ARCHA  
4. **Operational trust** — billing clear, platform reliable  

---

## We do NOT optimize for

- Feature parity with Shopify/WooCommerce  
- Maximum customization depth for power users  
- Desktop merchant ERP replacement  
- Crypto / Web3 commerce  
- Generic “no-code everything” builder  

---

## Decision filter (30 seconds)

Before building, ask:

1. Does this help **mobile Telegram commerce**?  
2. Does it reduce **merchant time-to-first-order**?  
3. Can a **non-technical merchant** use it?  
4. Does it increase **complexity** more than **value**?  

If #4 is yes and #1–#3 are weak → **don’t build**.

---

## Brand voice (tone)

| Context | Tone |
|---------|------|
| Onboarding | Encouraging, clear, short |
| Errors | Human, actionable — never raw IDs |
| Growth tips | Coach, not lecture |
| Billing | Transparent, no surprise |
| Support | Respectful, SLA-honest |

---

## Non-goals (living list)

See also [product-governance.md](./product-governance.md) and [complexity audit](./audits/complexity-audit.md).

| Never (12+ months) | Why |
|--------------------|-----|
| Cross-store unified cart | Complexity vs network discovery |
| Native iOS/Android apps | TG + browser sufficient |
| ML ranking v1 | Trust + transparency |
| Microservices split | Team size |
| Open marketplace uploads (themes) | Trust + moderation |
| Enterprise SSO | Premature |
| Feature parity with global SaaS giants | Focus KG/TG market |

---

## Related docs

- [UX Governance](./standards/ux-governance.md)
- [Product Operating Model](./product-operating-model.md)
- [Platform Brand Audit](./platform-brand-audit.md)
