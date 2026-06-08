import type { BusinessTemplateConfig } from "./types.js";

export const furnitureTemplate: BusinessTemplateConfig = {
  businessType: "furniture",
  templateVersion: 1,
  theme: {
    templateId: "light",
    themeConfig: {
      primaryColor: "#0f766e",
      bgColor: "#f8fafc",
      cardColor: "#ffffff",
      textColor: "#0f172a",
      layout: "classic",
      banner: {
        enabled: true,
        title: "Мебель для дома",
        subtitle: "Материалы, размеры и сборка",
      },
    },
  },
  defaultCategories: [
    { key: "living_room", name: "Гостиная" },
    { key: "bedroom", name: "Спальня" },
    { key: "office", name: "Офис" },
    { key: "kitchen", name: "Кухня" },
  ],
  productSchema: {
    material: { type: "text", label: "Материал", required: false, maxLen: 120 },
    dimensions: { type: "text", label: "Габариты", required: false, maxLen: 120 },
    colorFamily: { type: "text", label: "Цвет", required: false, maxLen: 64 },
    assemblyRequired: { type: "boolean", label: "Требуется сборка", required: false, default: true },
    warranty: { type: "text", label: "Гарантия", required: false, maxLen: 120 },
  },
  merchantSettingsSchema: {
    assemblyServiceEnabled: { type: "boolean", label: "Услуга сборки", required: false, default: true },
    liftingServiceEnabled: { type: "boolean", label: "Подъём на этаж", required: false, default: false },
    deliveryEnabled: { type: "boolean", label: "Доставка", required: false, default: true },
  },
  orderOptionsSchema: {},
  merchantConfig: {
    sections: [
      { key: "dimensions", title: "Размеры", enabled: true },
      { key: "material", title: "Материалы", enabled: true },
      { key: "services", title: "Сервис", enabled: true },
    ],
  },
  demoProducts: [
    {
      categoryKey: "living_room",
      name: "Диван Loft",
      price: 45900,
      image: "https://picsum.photos/seed/furniture-sofa/600/600",
      attributes: {
        material: "Велюр",
        dimensions: "230x95x90 см",
      },
    },
    {
      categoryKey: "office",
      name: "Стол Workline",
      price: 12900,
      image: "https://picsum.photos/seed/furniture-desk/600/600",
      attributes: {
        material: "ЛДСП/металл",
        dimensions: "140x70x75 см",
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
  cardRendererId: "furniture",
  modalRendererId: "product-experience-v2",
  catalogBehavior: {
    cardPlaceholder: "Выберите комплектацию",
    supportsTableReservations: false,
    imageRatioHint: "landscape",
    imageFitHint: "cover",
  },
  modalBehavior: {
    mode: "centered_v2",
    maxWidth: "lg",
    stickyActionBar: true,
  },
};
