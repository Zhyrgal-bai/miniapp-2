import {
  SAAS_SUBSCRIPTION_PRICE_30_D,
  SAAS_SUBSCRIPTION_PRICE_90_D,
  formatSaasPriceSom,
} from "@repo-shared/saasSubscriptionPricing";

export type ArchaFaqCategoryId =
  | "about"
  | "shop"
  | "payment"
  | "delivery"
  | "subscription"
  | "support";

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

export const ARCHA_FAQ_CATEGORIES: ArchaFaqCategory[] = [
  { id: "about", label: "О платформе", icon: "✨" },
  { id: "shop", label: "Магазин", icon: "🏪" },
  { id: "payment", label: "Оплата", icon: "💳" },
  { id: "delivery", label: "Доставка", icon: "🚚" },
  { id: "subscription", label: "Подписка", icon: "⭐" },
  { id: "support", label: "Поддержка", icon: "💬" },
];

const price30 = formatSaasPriceSom(SAAS_SUBSCRIPTION_PRICE_30_D);
const price90 = formatSaasPriceSom(SAAS_SUBSCRIPTION_PRICE_90_D);

/** Контент FAQ для владельцев бизнеса — без технических терминов. */
export const ARCHA_FAQ_ITEMS: ArchaFaqItem[] = [
  {
    id: "what-is-archa",
    categoryId: "about",
    question: "Что такое ARCHA?",
    paragraphs: [
      "ARCHA — это платформа для создания интернет-магазинов внутри Telegram.",
      "Вы можете создать магазин, добавлять товары, принимать заказы, подключить онлайн-оплату и управлять бизнесом прямо из Telegram.",
    ],
    bullets: [
      "Создать магазин",
      "Добавлять товары",
      "Принимать заказы",
      "Принимать онлайн-платежи",
      "Управлять бизнесом через Telegram",
    ],
    keywords: ["archa", "платформа", "telegram", "магазин"],
  },
  {
    id: "who-created-archa",
    categoryId: "about",
    question: "Кто создал ARCHA?",
    paragraphs: [
      "ARCHA создана командой основателей из Кыргызстана 🇰🇬",
    ],
    bullets: [
      "Жыргалбек — Instagram @zhyrgal4_ik",
      "Умар — Instagram @umar09r_",
      "Шаршенбек — Instagram @_sharshenbekov_kg",
    ],
    keywords: ["основатели", "команда", "создали", "instagram", "кыргызстан"],
  },
  {
    id: "who-is-it-for",
    categoryId: "about",
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
    id: "telegram-mini-app",
    categoryId: "about",
    question: "Как работает Telegram Mini App?",
    paragraphs: [
      "Покупатель открывает ваш магазин из Telegram-бота — внутри мессенджера запускается мини-приложение ARCHA.",
      "Там доступны каталог, корзина, оформление заказа и оплата. Вам не нужно устанавливать отдельное приложение: всё работает в Telegram на телефоне.",
      "Веб-витрина по ссылке показывает каталог и информацию о магазине; полное оформление заказа и оплата — в Telegram Mini App.",
    ],
    keywords: ["mini app", "бот", "telegram", "витрина"],
  },
  {
    id: "how-to-create-shop",
    categoryId: "shop",
    question: "Как создать магазин?",
    paragraphs: ["Путь от регистрации до первых заказов:"],
    bullets: [
      "Зарегистрируйтесь в ARCHA.",
      "Подключите Telegram-бота от @BotFather.",
      "Добавьте товары и категории.",
      "Опубликуйте витрину.",
      "Начните принимать заказы через бота.",
    ],
    keywords: ["создать", "регистрация", "бот", "товары", "витрина"],
  },
  {
    id: "how-payment-works",
    categoryId: "payment",
    question: "Как работает оплата?",
    paragraphs: [
      "Покупатели могут оплачивать заказы через Finik.",
      "После успешной оплаты заказ автоматически подтверждается — вам не нужно вручную проверять каждый перевод.",
      "Деньги поступают на счёт магазина, который вы подключаете при настройке Finik.",
    ],
    keywords: ["finik", "оплата", "заказ", "покупатель"],
  },
  {
    id: "payment-security",
    categoryId: "payment",
    question: "Безопасны ли платежи?",
    paragraphs: [
      "Да. ARCHA использует официальную интеграцию Finik.",
      "Платежи проходят через защищённые платёжные страницы Finik — данные карты обрабатываются на стороне платёжного сервиса, а не в чате Telegram.",
    ],
    keywords: ["безопасность", "finik", "карта", "защита"],
  },
  {
    id: "how-delivery-works",
    categoryId: "delivery",
    question: "Как работает доставка?",
    paragraphs: [
      "Каждый магазин самостоятельно настраивает условия доставки в панели управления.",
      "Вы выбираете, как считать стоимость и что предложить покупателю при оформлении заказа:",
    ],
    bullets: [
      "Самовывоз",
      "Фиксированная стоимость доставки",
      "Доставка по расстоянию",
      "Бесплатная доставка от суммы заказа",
    ],
    keywords: ["доставка", "самовывоз", "стоимость", "курьер"],
  },
  {
    id: "free-tier",
    categoryId: "subscription",
    question: "Можно ли использовать ARCHA бесплатно?",
    paragraphs: [
      "Для новых владельцев магазина доступен пробный период — 10 дней с полным доступом к функциям платформы.",
      "Пробный период предоставляется один раз на аккаунт Telegram.",
      `После окончания пробного периода для работы витрины и приёма заказов нужна подписка: ${price30} за 30 дней или ${price90} за 90 дней. Оплата подписки также проходит через Finik.`,
      "Без активной подписки или пробного периода витрина для покупателей будет недоступна.",
    ],
    keywords: ["бесплатно", "пробный", "подписка", "тариф", "trial"],
  },
  {
    id: "contact-support",
    categoryId: "support",
    question: "Как связаться с поддержкой?",
    paragraphs: [
      "Напишите нам в Telegram: @archa_kg — канал платформы ARCHA.",
      "Если вы уже в панели мерчанта, в разделе «Помощь» можно отправить обратную связь прямо из интерфейса — опишите проблему или идею, и команда платформы получит сообщение.",
      "По вопросам конкретного заказа покупатели обращаются через «Поддержка» в меню магазина — это чат с вашим магазином, а не с платформой.",
    ],
    keywords: ["поддержка", "контакт", "archa_kg", "помощь", "telegram"],
  },
];

export const ARCHA_FAQ_SUPPORT_TELEGRAM_URL = "https://t.me/archa_kg";
export const ARCHA_FAQ_SUPPORT_TELEGRAM_HANDLE = "@archa_kg";
