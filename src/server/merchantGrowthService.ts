import { prisma } from "./db.js";

export type GrowthChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  weight: number;
  href?: string;
};

export type MerchantGrowthPayload = {
  score: number;
  maxScore: number;
  checklist: GrowthChecklistItem[];
  recommendations: string[];
};

function hasHeroOrBanner(config: unknown): boolean {
  if (!config || typeof config !== "object") return false;
  const c = config as Record<string, unknown>;
  const blocks = c.blocks;
  if (!Array.isArray(blocks)) return false;
  return blocks.some((b) => {
    if (!b || typeof b !== "object") return false;
    const t = String((b as { type?: unknown }).type ?? "");
    return t === "hero" || t === "banner" || t === "HeroBlock" || t === "BannerBlock";
  });
}

export async function buildMerchantGrowth(
  businessId: number,
): Promise<MerchantGrowthPayload> {
  const bid = businessId;
  const [biz, productCount, categoryCount, orderCount, avgResponse] =
    await Promise.all([
      prisma.business.findUnique({
        where: { id: bid },
        select: {
          finikApiKey: true,
          storefrontPublishedAt: true,
          storefrontPublishedConfig: true,
          storefrontDraftConfig: true,
        },
      }),
      prisma.product.count({ where: { businessId: bid } }),
      prisma.category.count({ where: { businessId: bid } }),
      prisma.order.count({ where: { businessId: bid } }),
      prisma.supportMessage
        .findMany({
          where: {
            businessId: bid,
            senderType: "MERCHANT",
            createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
          },
          select: { createdAt: true, ticketId: true },
          take: 50,
        })
        .catch(() => []),
    ]);

  const published = Boolean(biz?.storefrontPublishedAt);
  const finik = Boolean(biz?.finikApiKey?.trim());
  const config =
    biz?.storefrontPublishedConfig ?? biz?.storefrontDraftConfig ?? {};
  const hero = hasHeroOrBanner(config);
  const fiveProducts = productCount >= 5;
  const hasCategories = categoryCount > 0;
  const firstOrder = orderCount > 0;

  const checklist: GrowthChecklistItem[] = [
    {
      id: "publish",
      label: "Витрина опубликована",
      done: published,
      weight: 20,
      href: "/admin/design",
    },
    {
      id: "products",
      label: "≥5 товаров в каталоге",
      done: fiveProducts,
      weight: 15,
      href: "/admin/products",
    },
    {
      id: "finik",
      label: "Finik подключён",
      done: finik,
      weight: 15,
      href: "/admin/settings",
    },
    {
      id: "categories",
      label: "Категории настроены",
      done: hasCategories,
      weight: 10,
      href: "/admin/categories",
    },
    {
      id: "hero",
      label: "Hero или баннер на витрине",
      done: hero,
      weight: 10,
      href: "/admin/design",
    },
    {
      id: "first_order",
      label: "Первый заказ получен",
      done: firstOrder,
      weight: 15,
      href: "/admin/orders",
    },
    {
      id: "support",
      label: "Ответы в поддержке (активность)",
      done: avgResponse.length >= 1,
      weight: 10,
      href: "/admin/support",
    },
  ];

  const maxScore = checklist.reduce((s, i) => s + i.weight, 0);
  const score = checklist
    .filter((i) => i.done)
    .reduce((s, i) => s + i.weight, 0);

  const recommendations = checklist
    .filter((i) => !i.done)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((i) => i.label);

  return { score, maxScore, checklist, recommendations };
}
