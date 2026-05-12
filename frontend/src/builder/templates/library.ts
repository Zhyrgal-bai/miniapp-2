import type { SectionCategory } from "../sectionLibrary/types";

export type TemplateLibraryItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  icon: string;
  category: SectionCategory;
  config: Record<string, unknown>;
};

export const TEMPLATE_LIBRARY: TemplateLibraryItem[] = [
  {
    id: "hero-luxury",
    type: "hero",
    title: "Luxury Hero",
    description: "Премиум hero с коротким CTA и акцентом на бренд.",
    icon: "✨",
    category: "Hero",
    config: {
      slides: [
        {
          title: "Премиум-коллекция",
          subtitle: "Ограниченная партия. Доставка по городу.",
          ctaText: "Смотреть",
          ctaUrl: "",
        },
      ],
    },
  },
  {
    id: "hero-fashion",
    type: "hero",
    title: "Fashion Hero",
    description: "Fashion hero для новой коллекции.",
    icon: "👗",
    category: "Hero",
    config: {
      slides: [
        {
          title: "New Collection",
          subtitle: "Streetwear / Essentials / Limited",
          ctaText: "Shop now",
          ctaUrl: "",
        },
      ],
    },
  },
  {
    id: "promo-black-friday",
    type: "promo",
    title: "Black Friday Promo",
    description: "Промо блоки под распродажу.",
    icon: "🖤",
    category: "Marketing",
    config: {
      blocks: [
        { title: "Black Friday", subtitle: "-30% на всё", imageUrl: "" },
        { title: "Limited Offer", subtitle: "Только 48 часов", imageUrl: "" },
      ],
    },
  },
  {
    id: "promo-new-collection",
    type: "promo",
    title: "New Collection Promo",
    description: "Промо для новой коллекции/меню.",
    icon: "🆕",
    category: "Marketing",
    config: {
      blocks: [{ title: "Новая коллекция", subtitle: "Свежие поступления", imageUrl: "" }],
    },
  },
];

