import type { BusinessTemplateConfig } from "./types.js";

export const fastfoodTemplate: BusinessTemplateConfig = {
  businessType: "fastfood",
  templateVersion: 1,
  theme: {
    templateId: "red",
    themeConfig: {
      primaryColor: "#ef4444",
      bgColor: "#0b0b0b",
      cardColor: "#1f1f1f",
      textColor: "#ffffff",
      layout: "modern",
      banner: {
        enabled: true,
        title: "Горячие комбо",
        subtitle: "Быстро и вкусно",
      },
    },
  },
  defaultCategories: [
    { key: "burgers", name: "Бургеры" },
    { key: "pizza", name: "Пицца" },
    { key: "drinks", name: "Напитки" },
    { key: "combo", name: "Комбо" },
  ],
  productSchema: {
    spicy: { type: "select", label: "Острота", required: false, values: ["no", "mild", "hot"], default: "no" },
    combo: { type: "boolean", label: "Комбо", required: false, default: false },
    addons: { type: "multiselect", label: "Добавки", required: false, values: ["cheese", "bacon", "sauce"] },
  },
  merchantSettingsSchema: {
    deliveryZones: { type: "text", label: "Зоны доставки (описание)", required: false, maxLen: 2048 },
    kitchen: { type: "text", label: "Кухня", required: false, maxLen: 280 },
    comboEnabled: { type: "boolean", label: "Комбо включено", required: false, default: true },
    reservationDepositEnabled: { type: "boolean", label: "Требовать депозит за бронь", required: false, default: false },
    reservationDepositAmountSom: { type: "number", label: "Сумма депозита (сом)", required: false, min: 1, max: 100000, default: 500 },
  },
  orderOptionsSchema: {
    spicy: { type: "select", label: "Острота", required: false, values: ["no", "mild", "hot"], default: "no" },
    combo: { type: "boolean", label: "Комбо", required: false, default: false },
    addons: { type: "multiselect", label: "Добавки", required: false, values: ["cheese", "bacon", "sauce"] },
  },
  merchantConfig: {
    sections: [
      { key: "deliveryZones", title: "Зоны доставки", enabled: true },
      { key: "kitchen", title: "Кухня", enabled: true },
      { key: "comboSettings", title: "Комбо", enabled: true },
      { key: "reservationBooking", title: "Настройки бронирования", enabled: true },
    ],
  },
  demoProducts: [
    {
      categoryKey: "burgers",
      name: "Бургер классик",
      price: 250,
      image: "https://picsum.photos/seed/fastfood-burger/600/600",
      attributes: { spicy: ["no", "mild", "hot"], addons: ["сыр", "бекон"] },
    },
    {
      categoryKey: "combo",
      name: "Комбо #1",
      price: 399,
      image: "https://picsum.photos/seed/fastfood-combo/600/600",
      attributes: { size: ["S", "M", "L"] },
    },
  ],
  variantPolicy: {
    mode: "single_axis",
    primaryAxisKey: "size",
    primaryAxisLabel: "Порция",
    secondaryAxisKey: null,
    secondaryAxisLabel: null,
    showFashionVariantMatrix: false,
    showOrderOptionsOnStorefront: true,
    variantEditor: "tier_stock",
    defaultPrimaryValues: [],
  },
  cardRendererId: "fastfood",
  modalRendererId: "product-experience-v2",
  catalogBehavior: {
    cardPlaceholder: "Средняя порция",
    supportsTableReservations: true,
    imageRatioHint: "square",
    imageFitHint: "cover",
  },
  modalBehavior: {
    mode: "centered_v2",
    maxWidth: "md",
    stickyActionBar: true,
  },
};

