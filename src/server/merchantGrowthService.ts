import { prisma } from "./db.js";
import { plainBotTokenFromStored } from "./businessBotToken.js";
import { isSubscriptionActive } from "./subscriptionAccess.js";
import {
  classifyWebhookOkError,
  fetchTelegramWebhookInfo,
} from "./platformTelegramWebhook.js";
import { isFinikCredentialsReady } from "../shared/finikReady.js";

export type GrowthChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  weight: number;
  href?: string;
};

/** Шаги запуска после approve (Block 3) — тот же endpoint store-readiness. */
export type LaunchWizardStepId =
  | "subscription"
  | "telegram_bot"
  | "finik"
  | "product"
  | "storefront"
  | "test_order";

export type LaunchWizardStep = {
  id: LaunchWizardStepId;
  label: string;
  done: boolean;
  hint: string;
};

export type LaunchWizardPayload = {
  complete: boolean;
  completedCount: number;
  totalSteps: number;
  /** Индекс первого незавершённого шага (для UI), -1 если всё готово. */
  currentStepIndex: number;
  steps: LaunchWizardStep[];
};

export type MerchantGrowthPayload = {
  score: number;
  maxScore: number;
  checklist: GrowthChecklistItem[];
  recommendations: string[];
  launchWizard: LaunchWizardPayload;
};

export function buildLaunchWizardPayload(input: {
  subscriptionActive: boolean;
  botConnected: boolean;
  finikReady: boolean;
  hasProduct: boolean;
  storefrontPublished: boolean;
  hasTestOrder: boolean;
}): LaunchWizardPayload {
  const steps: LaunchWizardStep[] = [
    {
      id: "subscription",
      label: "Подписка активна",
      done: input.subscriptionActive,
      hint: "Оплатите или дождитесь trial — без подписки витрина закрыта.",
    },
    {
      id: "telegram_bot",
      label: "Telegram Bot подключён",
      done: input.botConnected,
      hint: "Укажите токен бота и проверьте webhook в настройках.",
    },
    {
      id: "finik",
      label: "Finik готов",
      done: input.finikReady,
      hint: "Сохраните API Key и Account ID, скопируйте webhook в кабинет Finik.",
    },
    {
      id: "product",
      label: "Добавлен товар",
      done: input.hasProduct,
      hint: "Создайте хотя бы один товар в каталоге.",
    },
    {
      id: "storefront",
      label: "Проверена витрина",
      done: input.storefrontPublished,
      hint: "Опубликуйте витрину в разделе оформления.",
    },
    {
      id: "test_order",
      label: "Выполнен тестовый заказ",
      done: input.hasTestOrder,
      hint: "Откройте витрину и оформите пробный заказ от имени покупателя.",
    },
  ];
  const completedCount = steps.filter((s) => s.done).length;
  const currentStepIndex = steps.findIndex((s) => !s.done);
  return {
    complete: completedCount === steps.length,
    completedCount,
    totalSteps: steps.length,
    currentStepIndex,
    steps,
  };
}

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
          isActive: true,
          isBlocked: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          subscriptionEndsAt: true,
          botToken: true,
          finikApiKey: true,
          finikAccountId: true,
          finikSecret: true,
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
  const finik = isFinikCredentialsReady(biz?.finikApiKey, biz?.finikAccountId);
  const config =
    biz?.storefrontPublishedConfig ?? biz?.storefrontDraftConfig ?? {};
  const hero = hasHeroOrBanner(config);
  const fiveProducts = productCount >= 5;
  const hasCategories = categoryCount > 0;
  const firstOrder = orderCount > 0;
  const hasProduct = productCount >= 1;

  const subscriptionActive =
    biz != null && isSubscriptionActive(biz);
  const botToken = plainBotTokenFromStored(biz?.botToken ?? null);
  const webhookInfo =
    botToken.length > 0
      ? await fetchTelegramWebhookInfo(botToken)
      : {
          telegramApiOk: false,
          webhookUrl: null,
          lastErrorMessage: "Токен бота не задан",
        };
  const botConnected =
    botToken.length > 0 && classifyWebhookOkError(webhookInfo) === "OK";

  const launchWizard = buildLaunchWizardPayload({
    subscriptionActive,
    botConnected,
    finikReady: finik,
    hasProduct,
    storefrontPublished: published,
    hasTestOrder: firstOrder,
  });

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
      label: "Finik готов (API Key + Account ID)",
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

  return { score, maxScore, checklist, recommendations, launchWizard };
}
