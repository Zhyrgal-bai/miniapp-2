# Stage 1 — Single token pipeline and per-surface scope

This document specifies **how to replace** the current triple theme path (`--store-*` on `documentElement`, `--sf-*` from `ThemeVarsProvider`, and inline layout vars in `App.tsx`) with **one architecture**, without implementing UI here.

Related: [API inventory](./frontend-api-inventory.md), [Stages 2–6 roadmap](./greenfield-ui-stages-2-6-roadmap.md).

## Current state (baseline)

| Mechanism | File(s) | Problem |
|-----------|---------|---------|
| Legacy root CSS vars | [`ThemeContext.tsx`](../frontend/src/context/ThemeContext.tsx) | Sets `--store-*`, mutates `body` bg/color globally for all routes |
| Scoped storefront vars | [`applyThemeVars.ts`](../frontend/src/components/storefront/theme/applyThemeVars.ts), [`ThemeVarsProvider.tsx`](../frontend/src/components/storefront/theme/ThemeVarsProvider.tsx) | Correct direction; duplicated with root legacy |
| Inline layout / kit vars | [`App.tsx`](../frontend/src/App.tsx), [`StorefrontRenderer.tsx`](../frontend/src/components/storefront/StorefrontRenderer.tsx) | Second layout engine; `kitFromTemplateId` duplicated |
| Global body in `index.css` | [`index.css`](../frontend/src/index.css) | Uses `--sf-*` fallbacks even when storefront never mounted |

## Target model

### 1. Canonical token source

- **Server**: `ResolvedStoreTheme` + embedded `tokensV3` ([`src/shared/storeTheme.ts`](../src/shared/storeTheme.ts), [`resolveThemeV3.ts`](../src/themeSystem/resolveThemeV3.ts)).
- **Client**: one pure function **`themeToCssVars(theme: ResolvedStoreTheme): Record<string, string>`** (evolve current `applyThemeVars`; no `documentElement` writes).

### 2. Per-surface scoping

- Add root attribute on each major shell: `data-surface="storefront" | "merchant" | "admin" | "builder"`.
- Apply CSS variables on **`[data-surface="…"]` host element** only (the scroll root for that surface), not on `html`/`body`, except:
  - **Neutral reset**: `body { margin: 0; box-sizing; min-height }` without theme colors.
- **Merchant / platform** uses either a **fixed neutral theme** (platform branding) or a **minimal `tokensV3` preset** unrelated to shop theme — never inherit customer `--sf-*` from a previous navigation without a full remount.

### 3. Removal plan for legacy (`--store-*`)

1. Grep codebase for `--store-` and `var(--store` — today only [`ThemeContext.tsx`](../frontend/src/context/ThemeContext.tsx) sets them (from prior audit).
2. After new primitives exist, delete the `useEffect` block that sets/removes `--store-*` and clears `body` styles; migrate any remaining consumer to `--sf-*` or renamed semantic vars.
3. Keep `ThemeContext` only for **React state** (`theme`, `loading`, `refresh`, `setThemeDraft`) — not for side-effect DOM globals.

### 4. Consolidate layout → CSS vars

- Extract the large inline style object from [`App.tsx`](../frontend/src/App.tsx) into **`resolveStorefrontLayoutVars(storefrontStyleConfig, templateId) -> Record<string, string>`** (single module, unit-testable).
- [`StorefrontRenderer.tsx`](../frontend/src/components/storefront/StorefrontRenderer.tsx) should call the **same** helper (delete duplicate `kitFromTemplateId` / duplicate cssVars partial).
- **Kit CSS** ([`storefrontKits.css`](../frontend/src/components/storefront/storefrontKits.css)): keep `data-sf-kit` as a **presentation class** only; kit id comes from one `templateId → kit` function.

### 5. Stage 1 exit criteria (from roadmap)

- A **preview route** (e.g. `/__ui/shell` behind `import.meta.env.DEV` or `VITE_UI_V2`) renders an empty layout with:
  - `data-surface` set
  - full `--sf-*` (or renamed) set from **only** `tokensV3` + layout helper
  - no `--store-*` and no `body` background side effects from `ThemeContext`
- Telegram Mini App: verify **safe-area** and scroll on that shell only.

### 6. Tailwind alignment

- Pick **one** Tailwind major version for Vite ([`vite.config.ts`](../frontend/vite.config.ts) vs [`frontend/package.json`](../frontend/package.json)) and document in Stage 1 PR — either utilities bound to CSS variables or CSS-first with minimal `@apply`.

## Dependencies

- Stage 0 inventory ([`docs/frontend-api-inventory.md`](./frontend-api-inventory.md)) for which screens need which surface.
- Later: Stage 2+ consumes the same `ThemeRoot` wrapper for storefront sections.
