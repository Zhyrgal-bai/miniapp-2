import {
  SAAS_SUBSCRIPTION_PRICE_30_D,
  SAAS_SUBSCRIPTION_PRICE_90_D,
  formatSaasPriceSom,
} from "@repo-shared/saasSubscriptionPricing";
import { ARCHA_BRAND } from "../config/brandAssets";

export type ArchaFaqCategoryId = string;

export type ArchaFaqItem = {
  id: string;
  categoryId: ArchaFaqCategoryId;
  question: string;
  paragraphs: string[];
  bullets?: string[];
  keywords?: string[];
};

export type ArchaFaqCategory = {
  id: ArchaFaqCategoryId;
  label: string;
  icon: string;
};

/** FAQ платформы ARCHA — только для мерчантов (/merchant/faq). */
export const ARCHA_FAQ_CATEGORIES: ArchaFaqCategory[] = [
  { id: "platform", label: "Платформа", icon: "✨" },
  { id: "shop", label: "Магазин", icon: "🏪" },
  { id: "subscription", label: "Подписка", icon: "💎" },
  { id: "founders", label: "Основатели", icon: "🇰🇬" },
  { id: "support", label: "Поддержка", icon: "💬" },
];

const price30 = formatSaasPriceSom(SAAS_SUBSCRIPTION_PRICE_30_D);
const price90 = formatSaasPriceSom(SAAS_SUBSCRIPTION_PRICE_90_D);

export const ARCHA_FAQ_ITEMS: ArchaFaqItem[] = [
  {
    id: "what-is-archa",
    categoryId: "platform",
    question: "Что такое ARCHA?",
    paragraphs: [
      "ARCHA — платформа для создания интернет-магазинов внутри Telegram.",
      "Вы создаёте магазин, подключаете бота, добавляете товары и принимаете заказы с оплатой через Finik — без отдельного сайта.",
    ],
    keywords: ["archa", "платформа", "telegram", "магазин"],
  },
  {
    id: "telegram-mini-app",
    categoryId: "platform",
    question: "Как работает Telegram Mini App?",
    paragraphs: [
      "Покупатель открывает магазин из вашего Telegram-бота — внутри мессенджера запускается мини-приложение ARCHA.",
      "В нём доступны каталог, корзина, оформление и оплата. Веб-витрина по ссылке показывает каталог; полное оформление — в Telegram.",
    ],
    keywords: ["mini app", "бот", "telegram", "витрина"],
  },
  {
    id: "who-is-it-for",
    categoryId: "platform",
    question: "Для кого подходит ARCHA?",
    paragraphs: ["ARCHA подходит для локального бизнеса и онлайн-продаж в Telegram:"],
    bullets: [
      "Магазины одежды",
      "Кофеен",
      "Фастфуда",
      "Цветочных магазинов",
      "Доставки еды",
      "Локального бизнеса",
    ],
    keywords: ["одежда", "кофе", "еда", "цветы", "бизнес"],
  },
  {
    id: "how-to-create-shop",
    categoryId: "shop",
    question: "Как создать магазин?",
    paragraphs: ["Путь от регистрации до первых заказов:"],
    bullets: [
      "Нажмите «Создать магазин» в панели ARCHA.",
      "Подключите Telegram-бота от @BotFather.",
      "Добавьте товары и категории.",
      "Опубликуйте витрину и поделитесь ссылкой.",
      "Принимайте заказы через бота.",
    ],
    keywords: ["создать", "регистрация", "бот", "товары", "витрина"],
  },
  {
    id: "free-tier",
    categoryId: "subscription",
    question: "Можно ли использовать ARCHA бесплатно?",
    paragraphs: [
      "Для новых владельцев доступен пробный период — 10 дней с полным доступом.",
      "Пробный период предоставляется один раз на аккаунт Telegram.",
      `После пробного периода нужна подписка: ${price30} за 30 дней или ${price90} за 90 дней. Оплата — через Finik.`,
      "Без активной подписки или trial витрина для покупателей будет недоступна.",
    ],
    keywords: ["бесплатно", "пробный", "подписка", "тариф", "trial"],
  },
  {
    id: "who-created-archa",
    categoryId: "founders",
    question: "Кто создал ARCHA?",
    paragraphs: ["ARCHA создана командой основателей из Кыргызстана 🇰🇬"],
    bullets: [
      "Жыргалбек — Instagram @zhyrgal4_ik",
      "Умар — Instagram @umar09r_",
      "Шаршенбек — Instagram @_sharshenbekov_kg",
    ],
    keywords: ["основатели", "команда", "создали", "instagram", "кыргызстан"],
  },
  {
    id: "contact-support",
    categoryId: "support",
    question: "Как связаться с поддержкой ARCHA?",
    paragraphs: [
      `Напишите боту платформы ${ARCHA_BRAND.telegramBotHandle} в Telegram.`,
      "Если вы в панели мерчанта — в разделе «Помощь» можно отправить обратную связь из интерфейса.",
      "По вопросам конкретного заказа покупатели обращаются через «Поддержка» в меню магазина — это чат с магазином, а не с платформой.",
    ],
    keywords: ["поддержка", "контакт", "бот", "помощь", "telegram"],
  },
];

export const ARCHA_FAQ_SUPPORT_TELEGRAM_URL = ARCHA_BRAND.telegramLoginUrl;
export const ARCHA_FAQ_SUPPORT_TELEGRAM_HANDLE = ARCHA_BRAND.telegramBotHandle;
