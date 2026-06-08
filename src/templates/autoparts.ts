import type { BusinessTemplateConfig } from "./types.js";

export const autopartsTemplate: BusinessTemplateConfig = {
  businessType: "autoparts",
  templateVersion: 1,
  theme: {
    templateId: "dark",
    themeConfig: {
      primaryColor: "#f97316",
      bgColor: "#111111",
      cardColor: "#1f2937",
      textColor: "#f3f4f6",
      layout: "modern",
      banner: {
        enabled: true,
        title: "Автозапчасти",
        subtitle: "Подбор по авто и VIN",
      },
    },
  },
  defaultCategories: [
    { key: "engine", name: "Двигатель" },
    { key: "suspension", name: "Подвеска" },
    { key: "brakes", name: "Тормоза" },
    { key: "consumables", name: "Расходники" },
  ],
  productSchema: {
    brand: { type: "text", label: "Бренд", required: false, maxLen: 80 },
    sku: { type: "text", label: "Артикул", required: false, maxLen: 64 },
    oem: { type: "text", label: "OEM номер", required: false, maxLen: 64 },
    compatibleModels: {
      type: "text",
      label: "Совместимые модели",
      required: false,
      maxLen: 512,
    },
    modelYear: { type: "text", label: "Год автомобиля", required: false, maxLen: 64 },
    engine: { type: "text", label: "Двигатель", required: false, maxLen: 120 },
    compatibility: {
      type: "text",
      label: "Совместимость (кратко)",
      required: false,
      maxLen: 512,
    },
  },
  merchantSettingsSchema: {
    compatibilityGuide: {
      type: "text",
      label: "Инструкция по подбору",
      required: false,
      maxLen: 2048,
    },
    pickupAvailable: { type: "boolean", label: "Самовывоз", required: false, default: true },
    deliveryEnabled: { type: "boolean", label: "Доставка", required: false, default: true },
  },
  orderOptionsSchema: {
    vin: { type: "text", label: "VIN автомобиля", required: false, maxLen: 32 },
  },
  merchantConfig: {
    sections: [
      { key: "compatibility", title: "Совместимость", enabled: true },
      { key: "sku", title: "Артикулы", enabled: true },
      { key: "delivery", title: "Доставка", enabled: true },
    ],
  },
  demoProducts: [
    {
      categoryKey: "brakes",
      name: "Колодки передние AX-205",
      price: 3200,
      image: "https://picsum.photos/seed/autoparts-brake/600/600",
      attributes: {
        brand: "Apex",
        sku: "AX-205",
        oem: "04465-02230",
        compatibleModels: "Toyota Camry XV70",
        modelYear: "2018–2023",
        engine: "2.5L / 3.5L",
        compatibility: "Toyota Camry 2018-2023",
      },
    },
    {
      categoryKey: "consumables",
      name: "Масляный фильтр OF-11",
      price: 650,
      image: "https://picsum.photos/seed/autoparts-filter/600/600",
      attributes: {
        brand: "FilterPro",
        sku: "OF-11",
        oem: "26300-35504",
        compatibleModels: "Hyundai Elantra, Kia Cerato",
        engine: "1.6 Gamma",
        compatibility: "Hyundai/Kia 1.6",
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
    showOrderOptionsOnStorefront: true,
    variantEditor: "none",
    defaultPrimaryValues: [],
  },
  cardRendererId: "autoparts",
  modalRendererId: "product-experience-v2",
  catalogBehavior: {
    cardPlaceholder: "Проверьте совместимость",
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
