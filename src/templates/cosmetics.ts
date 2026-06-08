import type { BusinessTemplateConfig } from "./types.js";

export const cosmeticsTemplate: BusinessTemplateConfig = {
  businessType: "cosmetics",
  templateVersion: 1,
  theme: {
    templateId: "light",
    themeConfig: {
      primaryColor: "#db2777",
      bgColor: "#fff7fb",
      cardColor: "#ffe4f0",
      textColor: "#111827",
      layout: "modern",
      banner: {
        enabled: true,
        title: "Бьюти и уход",
        subtitle: "Состав и рекомендации",
      },
    },
  },
  defaultCategories: [
    { key: "makeup", name: "Макияж" },
    { key: "skincare", name: "Уход за кожей" },
    { key: "haircare", name: "Уход за волосами" },
    { key: "perfume", name: "Парфюмерия" },
  ],
  productSchema: {
    brand: { type: "text", label: "Бренд", required: false, maxLen: 80 },
    volume: { type: "text", label: "Объём", required: false, maxLen: 64 },
    ingredients: { type: "text", label: "Состав", required: false, maxLen: 4096 },
    skinType: {
      type: "select",
      label: "Тип кожи",
      required: false,
      values: ["all", "dry", "normal", "oily", "combo", "sensitive"],
      default: "all",
    },
  },
  merchantSettingsSchema: {
    consultationEnabled: { type: "boolean", label: "Консультация", required: false, default: true },
    giftWrapEnabled: { type: "boolean", label: "Подарочная упаковка", required: false, default: false },
    deliveryEnabled: { type: "boolean", label: "Доставка", required: false, default: true },
  },
  orderOptionsSchema: {},
  merchantConfig: {
    sections: [
      { key: "ingredients", title: "Состав", enabled: true },
      { key: "skinType", title: "Тип кожи", enabled: true },
      { key: "delivery", title: "Доставка", enabled: true },
    ],
  },
  demoProducts: [
    {
      categoryKey: "skincare",
      name: "Hydra Serum",
      price: 1890,
      image: "https://picsum.photos/seed/cosmetics-serum/600/600",
      attributes: {
        volume: "30 мл",
        skinType: "all",
      },
    },
    {
      categoryKey: "makeup",
      name: "Velvet Lip Tint",
      price: 990,
      image: "https://picsum.photos/seed/cosmetics-lip/600/600",
      attributes: {
        volume: "8 мл",
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
  cardRendererId: "cosmetics",
  modalRendererId: "product-experience-v2",
  catalogBehavior: {
    cardPlaceholder: "Выберите объём",
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
