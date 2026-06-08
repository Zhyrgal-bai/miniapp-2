import type { BusinessTemplateConfig } from "./types.js";

export const coffeeTemplate: BusinessTemplateConfig = {
  businessType: "coffee",
  templateVersion: 1,
  theme: {
    templateId: "light",
    themeConfig: {
      primaryColor: "#b45309",
      bgColor: "#fff7ed",
      cardColor: "#ffedd5",
      textColor: "#1f2937",
      layout: "modern",
      banner: {
        enabled: true,
        title: "Тёплый кофе",
        subtitle: "Свежеобжаренный каждый день",
      },
    },
  },
  defaultCategories: [
    { key: "coffee", name: "Кофе" },
    { key: "desserts", name: "Десерты" },
    { key: "breakfasts", name: "Завтраки" },
    { key: "drinks", name: "Напитки" },
  ],
  productSchema: {
    hotOrCold: { type: "select", label: "Горячее/Холодное", required: true, values: ["hot", "ice"] },
    sugar: { type: "select", label: "Сахар", required: false, values: ["no", "less", "normal"], default: "normal" },
    syrups: { type: "multiselect", label: "Сиропы", required: false, values: ["vanilla", "caramel", "hazelnut"] },
  },
  merchantSettingsSchema: {
    cookTimeMinutes: { type: "number", label: "Время готовки (мин)", required: false, min: 0, max: 180 },
    hasTables: { type: "boolean", label: "Есть столики", required: false, default: true },
    deliveryEnabled: { type: "boolean", label: "Доставка включена", required: false, default: true },
    reservationDepositEnabled: { type: "boolean", label: "Требовать депозит за бронь", required: false, default: false },
    reservationDepositAmountSom: { type: "number", label: "Сумма депозита (сом)", required: false, min: 1, max: 100000, default: 500 },
  },
  orderOptionsSchema: {
    hotOrCold: { type: "select", label: "Горячее/Холодное", required: true, values: ["hot", "ice"] },
    milk: {
      type: "select",
      label: "Молоко",
      required: false,
      values: ["regular", "coconut", "soy"],
      default: "regular",
    },
    sugar: {
      type: "select",
      label: "Сахар",
      required: false,
      values: ["0", "50", "100", "no", "less", "normal"],
      default: "50",
    },
    syrups: { type: "multiselect", label: "Сиропы", required: false, values: ["vanilla", "caramel", "hazelnut"] },
  },
  merchantConfig: {
    sections: [
      { key: "cookTime", title: "Время готовки", enabled: true },
      { key: "tables", title: "Столики", enabled: true },
      { key: "delivery", title: "Доставка", enabled: true },
      { key: "reservationBooking", title: "Настройки бронирования", enabled: true },
    ],
  },
  demoProducts: [
    {
      categoryKey: "coffee",
      name: "Капучино",
      price: 180,
      image: "https://picsum.photos/seed/coffee-cappuccino/600/600",
      attributes: { volume: ["250ml", "350ml"], hotOrCold: ["hot", "ice"] },
    },
    {
      categoryKey: "desserts",
      name: "Чизкейк",
      price: 220,
      image: "https://picsum.photos/seed/coffee-cheesecake/600/600",
      attributes: { sugar: ["normal", "less"] },
    },
  ],
  variantPolicy: {
    mode: "single_axis",
    primaryAxisKey: "size",
    primaryAxisLabel: "Объём",
    secondaryAxisKey: null,
    secondaryAxisLabel: null,
    showFashionVariantMatrix: false,
    showOrderOptionsOnStorefront: true,
    variantEditor: "tier_stock",
    defaultPrimaryValues: [],
  },
  cardRendererId: "coffee",
  modalRendererId: "product-experience-v2",
  catalogBehavior: {
    cardPlaceholder: "350 мл • горячий",
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

