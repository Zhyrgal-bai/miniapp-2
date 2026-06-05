/** Callback data для раздела «О проекте» в регистрационном боте. */
export const SAAS_CB_ABOUT = "saas_about";
export const SAAS_CB_BACK_MENU = "saas_back_menu";

export type ArchaFounder = {
  name: string;
  instagramHandle: string;
  instagramUrl: string;
};

/** Проверенные ссылки Instagram (ARCHA UX Phase 5). */
export const ARCHA_FOUNDERS: readonly ArchaFounder[] = [
  {
    name: "Жыргалбек",
    instagramHandle: "zhyrgal4_ik",
    instagramUrl: "https://instagram.com/zhyrgal4_ik",
  },
  {
    name: "Умар",
    instagramHandle: "umar09r_",
    instagramUrl: "https://instagram.com/umar09r_",
  },
  {
    name: "Шаршенбек",
    instagramHandle: "_sharshenbekov_kg",
    instagramUrl: "https://instagram.com/_sharshenbekov_kg",
  },
] as const;

export function archaAboutMenuButton(): {
  text: string;
  callback_data: string;
} {
  return { text: "ℹ️ О проекте", callback_data: SAAS_CB_ABOUT };
}

export function buildArchaAboutMessage(): string {
  return buildArchaAboutMessageHtml().replace(/<[^>]+>/g, "");
}

/** HTML для Telegram (кликабельные ссылки Instagram). */
export function buildArchaAboutMessageHtml(): string {
  const founderBlocks = ARCHA_FOUNDERS.map(
    (f) =>
      [
        `👨‍💻 ${f.name}`,
        `Instagram: <a href="${f.instagramUrl}">@${f.instagramHandle}</a>`,
      ].join("\n"),
  ).join("\n\n");

  return [
    "🚀 <b>ARCHA</b>",
    "",
    "ARCHA — это платформа для создания интернет-магазинов внутри Telegram.",
    "",
    "С помощью ARCHA предприниматели могут:",
    "",
    "• создавать магазины",
    "• добавлять товары",
    "• принимать заказы",
    "• принимать онлайн-платежи",
    "• управлять бизнесом через Telegram",
    "",
    "Сделано в Кыргызстане 🇰🇬",
    "",
    "—",
    "",
    "👥 <b>Основатели проекта</b>",
    "",
    founderBlocks,
    "",
    "—",
    "",
    "🎯 <b>Наша миссия</b>",
    "",
    "Мы создаём удобную платформу,",
    "которая помогает предпринимателям",
    "запускать продажи через Telegram",
    "без сложной настройки и больших затрат.",
  ].join("\n");
}

export function buildArchaFoundersFaqAnswer(): string {
  const lines = ARCHA_FOUNDERS.map(
    (f) => `👨‍💻 ${f.name}\nInstagram: @${f.instagramHandle}`,
  );
  return [
    "ARCHA создана командой основателей из Кыргызстана 🇰🇬",
    "",
    ...lines,
  ].join("\n\n");
}

type InlineUrlBtn = { text: string; url: string };
type InlineCbBtn = { text: string; callback_data: string };

export function archaAboutInlineKeyboard(): {
  inline_keyboard: Array<Array<InlineUrlBtn | InlineCbBtn>>;
} {
  const instagramRows: InlineUrlBtn[][] = ARCHA_FOUNDERS.map((f) => [
    {
      text: `📸 Instagram ${f.name}`,
      url: f.instagramUrl,
    },
  ]);
  return {
    inline_keyboard: [
      ...instagramRows,
      [{ text: "◀️ Назад", callback_data: SAAS_CB_BACK_MENU }],
    ],
  };
}
