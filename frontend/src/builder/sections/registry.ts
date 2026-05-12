import type { BuilderSection } from "../../services/storefrontBuilderApi";

export type SectionMeta = {
  type: BuilderSection["type"];
  title: string;
  icon?: string;
};

export const SECTION_MARKETPLACE: SectionMeta[] = [
  { type: "hero", title: "Hero", icon: "🧩" },
  { type: "promo", title: "Promo", icon: "🏷️" },
  { type: "categories", title: "Категории", icon: "🗂️" },
  { type: "featuredProducts", title: "Хиты", icon: "⭐" },
  { type: "footer", title: "Footer", icon: "🧾" },
  { type: "reviews", title: "Reviews", icon: "💬" },
  { type: "faq", title: "FAQ", icon: "❓" },
  { type: "countdown", title: "Countdown", icon: "⏳" },
  { type: "storySlider", title: "Story Slider", icon: "📱" },
  { type: "videoBanner", title: "Video Banner", icon: "🎬" },
];

export function defaultSection(type: string): BuilderSection {
  const idBase = type.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const id = `${idBase}-${Math.random().toString(16).slice(2, 8)}`;
  return {
    id,
    type,
    enabled: true,
    order: Date.now(),
    config: {},
  };
}

