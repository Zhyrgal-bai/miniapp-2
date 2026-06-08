import type { BusinessTemplateConfig } from "./types.js";

export const clothingTemplate: BusinessTemplateConfig = {
  businessType: "clothing",
  templateVersion: 1,
  theme: {
    templateId: "luxury",
    themeConfig: {
      primaryColor: "#d4af37",
      bgColor: "#0a0908",
      cardColor: "#1a1814",
      textColor: "#f5f0e6",
      layout: "classic",
      banner: {
        enabled: true,
        title: "Новая коллекция",
        subtitle: "Премиум стиль",
      },
    },
  },
  defaultCategories: [
    { key: "mens", name: "Мужское" },
    { key: "womens", name: "Женское" },
    { key: "shoes", name: "Обувь" },
    { key: "accessories", name: "Аксессуары" },
  ],
  productSchema: {
    brand: { type: "text", label: "Бренд", required: false, maxLen: 60 },
    material: { type: "text", label: "Материал", required: false, maxLen: 80 },
    gender: {
      type: "select",
      label: "Пол",
      required: false,
      values: ["male", "female", "unisex"],
      default: "unisex",
    },
  },
  merchantSettingsSchema: {
    sizeTable: { type: "text", label: "Таблица размеров (URL или текст)", required: false, maxLen: 2048 },
    brands: { type: "multiselect", label: "Бренды", required: false, values: ["Demo", "Nike", "Adidas"] },
    collections: { type: "multiselect", label: "Коллекции", required: false, values: ["Summer", "Winter", "Basic"] },
  },
  orderOptionsSchema: {},
  merchantConfig: {
    sections: [
      { key: "sizeTable", title: "Таблица размеров", enabled: true },
      { key: "brands", title: "Бренды", enabled: true },
      { key: "collections", title: "Коллекции", enabled: true },
    ],
  },
  demoProducts: [
    {
      categoryKey: "mens",
      name: "Футболка базовая",
      price: 990,
      image: "https://picsum.photos/seed/clothing-tee/600/600",
      attributes: { size: ["S", "M", "L"], color: ["Черный", "Белый"] },
    },
    {
      categoryKey: "shoes",
      name: "Кроссовки",
      price: 3490,
      image: "https://picsum.photos/seed/clothing-shoes/600/600",
      attributes: { size: ["40", "41", "42"], brand: "Demo" },
    },
  ],
  variantPolicy: {
    mode: "sku_matrix",
    primaryAxisKey: "size",
    primaryAxisLabel: "Размер",
    secondaryAxisKey: "color",
    secondaryAxisLabel: "Цвет",
    showFashionVariantMatrix: true,
    showOrderOptionsOnStorefront: false,
    variantEditor: "clothing_matrix",
    defaultPrimaryValues: [],
  },
  cardRendererId: "clothing",
  modalRendererId: "product-experience-v2",
  catalogBehavior: {
    cardPlaceholder: "Выберите размер и цвет",
    supportsTableReservations: false,
    imageRatioHint: "portrait",
    imageFitHint: "cover",
  },
  modalBehavior: {
    mode: "centered_v2",
    maxWidth: "md",
    stickyActionBar: true,
  },
};

