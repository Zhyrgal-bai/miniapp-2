import { BusinessType } from "@prisma/client";
import type { BusinessTemplateConfig } from "./types.js";

export const fastfoodTemplate: BusinessTemplateConfig = {
  businessType: BusinessType.fastfood,
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
    size: { type: "select", label: "Размер", required: false, values: ["S", "M", "L"], default: "M" },
  },
  merchantSettingsSchema: {
    deliveryZones: { type: "text", label: "Зоны доставки (описание)", required: false, maxLen: 2048 },
    kitchen: { type: "text", label: "Кухня", required: false, maxLen: 280 },
    comboEnabled: { type: "boolean", label: "Комбо включено", required: false, default: true },
  },
  orderOptionsSchema: {
    spicy: { type: "select", label: "Острота", required: false, values: ["no", "mild", "hot"], default: "no" },
    combo: { type: "boolean", label: "Комбо", required: false, default: false },
    addons: { type: "multiselect", label: "Добавки", required: false, values: ["cheese", "bacon", "sauce"] },
    size: { type: "select", label: "Размер", required: false, values: ["S", "M", "L"], default: "M" },
  },
  merchantConfig: {
    sections: [
      { key: "deliveryZones", title: "Зоны доставки", enabled: true },
      { key: "kitchen", title: "Кухня", enabled: true },
      { key: "comboSettings", title: "Комбо", enabled: true },
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
};

