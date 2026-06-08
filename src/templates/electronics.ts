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
    display: { type: "text", label: "Дисплей", required: false, maxLen: 160 },
    cpu: { type: "text", label: "Процессор", required: false, maxLen: 120 },
    ram: { type: "text", label: "ОЗУ", required: false, maxLen: 64 },
    storage: { type: "text", label: "Накопитель", required: false, maxLen: 64 },
    battery: { type: "text", label: "Батарея", required: false, maxLen: 80 },
    warranty: { type: "text", label: "Гарантия", required: false, maxLen: 120 },
    kitContents: { type: "text", label: "Комплектация", required: false, maxLen: 512 },
    serialNumber: { type: "text", label: "Серийный номер", required: false, maxLen: 64 },
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
        display: '6.7" OLED 120Hz',
        cpu: "Snapdragon 8 Gen 2",
        ram: "8 GB",
        storage: "256 GB",
        battery: "5000 mAh",
        warranty: "12 месяцев",
        kitContents: "Кабель USB-C, документация",
        variants: [
          {
            color: { name: "Чёрный", hex: "#1a1a1a" },
            sizes: [
              { size: "128GB", stock: 5 },
              { size: "256GB", stock: 3 },
            ],
          },
          {
            color: { name: "Серебро", hex: "#c0c0c0" },
            sizes: [
              { size: "128GB", stock: 2 },
              { size: "256GB", stock: 0 },
            ],
          },
        ],
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
        battery: "30 ч с кейсом",
        warranty: "6 месяцев",
      },
    },
  ],
  variantPolicy: {
    mode: "sku_matrix",
    primaryAxisKey: "memory",
    primaryAxisLabel: "Память",
    secondaryAxisKey: "color",
    secondaryAxisLabel: "Цвет",
    showFashionVariantMatrix: true,
    showOrderOptionsOnStorefront: false,
    variantEditor: "clothing_matrix",
    defaultPrimaryValues: [],
  },
  cardRendererId: "electronics",
  modalRendererId: "product-experience-v2",
  catalogBehavior: {
    cardPlaceholder: "Выберите память и цвет",
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
