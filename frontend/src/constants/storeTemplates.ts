/** Реэкспорт пресетов витрины (единый источник — `src/shared/storeTheme.ts`). */
export {
  TEMPLATES,
  STORE_TEMPLATE_IDS,
  DEFAULT_STORE_THEME,
} from "@repo-shared/storeTheme";
export type { StoreTemplateId, ResolvedStoreTheme } from "@repo-shared/storeTheme";

/** Основной выбор шаблона SaaS в настройках (остальное — см. STORE_TEMPLATE_IDS). */
export const STORE_QUICK_TEMPLATE_IDS = ["red", "dark", "light"] as const;
