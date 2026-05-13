/** Платформенные строки RU по умолчанию (витрина и админка). Контент из Design Studio переопределяет через storefrontTextConfig / props. */
export const ru = {
  discovery: {
    titleTrending: "В тренде",
    titleRecentlyViewed: "Вы смотрели",
    titleBecauseViewed: "Потому что вы смотрели",
    titleRelated: "Похожие товары",
    titleHotNow: "Горячее сейчас",
  },
  admin: {
    analyticsSubtitle:
      "По заказам в базе данных. Выручка — сумма заказов в статусах «Оплачен», «Отправлен» и «Доставлен».",
    kpiAccepted: "Принято к работе",
    kpiPendingPayment: "Ожидают подтверждения оплаты",
    kpiShipped: "Отправлено",
    kpiDelivered: "Доставлено",
    revenueLabel: "Выручка (оплач. и отправл.)",
    period7: "7 дней",
    period30: "30 дней",
    period90: "90 дней",
    rangeRevenue: "Выручка за период",
    rangeOrders: "Заказов за период",
    topProducts: "Топ товаров по количеству",
    chartHint: "Дневная динамика в выбранном периоде",
  },
  common: {
    loading: "Загрузка…",
  },
} as const;
