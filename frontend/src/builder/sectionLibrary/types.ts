import type { StoreTemplateId } from "@repo-shared/storeTheme";

export type SectionCategory =
  | "Hero"
  | "Commerce"
  | "Social proof"
  | "Media"
  | "Marketing"
  | "Footer"
  | "Utility";

export type SectionLibraryItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  icon: string;
  previewImage?: string | null;
  category: SectionCategory;
  defaultConfig: Record<string, unknown>;
  supportedTemplates: Array<StoreTemplateId | "any">;
};

