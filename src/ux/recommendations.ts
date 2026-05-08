import type { UxIssue } from "./rules.js";

export type UxRecommendation = {
  title: string;
  items: UxIssue[];
};

export function buildUxRecommendations(warnings: UxIssue[]): UxRecommendation[] {
  if (!Array.isArray(warnings) || warnings.length === 0) return [];
  return [
    {
      title: "Рекомендации UX",
      items: warnings,
    },
  ];
}

