import type { BusinessTemplateConfig } from "./types.js";

export const electronicsTemplate: BusinessTemplateConfig = {
  businessType: "electronics",
  templateVersion: 1,
  theme: {
    templateId: "dark",
    themeConfig: {
      primaryColor: "#3b82f6",
      bgColor: "#0b1220",
      cardColor: "#111827",
      textColor: "#f8fafc",
      layout: "modern",
      banner: {
        enabled: true,
        title: "Гаджеты и электроника",
        subtitle: "Техника с гарантией",
      },
    },
  },
  defaultCategories: [
    { key: "phones", name: "Смартфоны" },
    { key: "laptops", name: "Ноутбуки" },
    { key: "audio", name: "Аудио" },
    { key: "accessories", name: "Аксессуары" },
  ],
  productSchema: {
    brand: { type: "text", label: "Бренд", required: false, maxLen: 80 },
    model: { type: "text", label: "Модель", required: false, maxLen: 120 },
    warranty: { type: "text", label: "Гарантия", required: false, maxLen: 120 },
    kitContents: { type: "text", label: "Комплектация", required: false, maxLen: 512 },
    serialNumber: { type: "text", label: "Серийный номер", required: false, maxLen: 64 },
    specifications: { type: "text", label: "Характеристики", required: false, maxLen: 4096 },
  },
  merchantSettingsSchema: {
    warrantyPolicy: { type: "text", label: "Условия гарантии", required: false, maxLen: 1024 },
    pickupAvailable: { type: "boolean", label: "Самовывоз", required: false, default: true },
    deliveryEnabled: { type: "boolean", label: "Доставка", required: false, default: true },
  },
  orderOptionsSchema: {},
  merchantConfig: {
    sections: [
      { key: "specs", title: "Характеристики", enabled: true },
      { key: "warranty", title: "Гарантия", enabled: true },
      { key: "delivery", title: "Доставка", enabled: true },
    ],
  },
  demoProducts: [
    {
      categoryKey: "phones",
      name: "Smart X Pro",
      price: 32990,
      image: "https://picsum.photos/seed/electronics-phone/600/600",
      attributes: {
        brand: "Archa",
        model: "X Pro",
        warranty: "12 месяцев",
        specifications: "8/256, OLED, NFC",
      },
    },
    {
      categoryKey: "audio",
      name: "Buds Air",
      price: 4990,
      image: "https://picsum.photos/seed/electronics-buds/600/600",
      attributes: {
        brand: "Archa",
        model: "Buds Air",
      },
    },
  ],
  variantPolicy: {
    mode: "metadata_only",
    primaryAxisKey: "size",
    primaryAxisLabel: "Вариант",
    secondaryAxisKey: null,
    secondaryAxisLabel: null,
    showFashionVariantMatrix: false,
    showOrderOptionsOnStorefront: false,
    variantEditor: "none",
    defaultPrimaryValues: [],
  },
  cardRendererId: "electronics",
  modalRendererId: "product-experience-v2",
  catalogBehavior: {
    cardPlaceholder: "Выберите характеристики",
    supportsTableReservations: false,
    imageRatioHint: "square",
    imageFitHint: "contain",
  },
  modalBehavior: {
    mode: "centered_v2",
    maxWidth: "lg",
    stickyActionBar: true,
  },
};
