import { BusinessType } from "@prisma/client";
import type { BusinessTemplateConfig } from "./types.js";

export const flowersTemplate: BusinessTemplateConfig = {
  businessType: BusinessType.flowers,
  templateVersion: 1,
  theme: {
    templateId: "luxury",
    themeConfig: {
      primaryColor: "#ec4899",
      bgColor: "#fff1f2",
      cardColor: "#ffe4e6",
      textColor: "#111827",
      layout: "classic",
      banner: {
        enabled: true,
        title: "Нежные букеты",
        subtitle: "С доставкой в выбранный день",
      },
    },
  },
  defaultCategories: [
    { key: "bouquets", name: "Букеты" },
    { key: "roses", name: "Розы" },
    { key: "boxes", name: "Коробки" },
    { key: "gifts", name: "Подарки" },
  ],
  productSchema: {
    bouquetCount: {
      type: "select",
      label: "Количество роз",
      required: false,
      values: ["3", "5", "7", "11", "21", "51", "101"],
    },
    packaging: { type: "select", label: "Упаковка", required: false, values: ["paper", "box"], default: "paper" },
    freshness: { type: "select", label: "Свежесть", required: false, values: ["today", "tomorrow"], default: "today" },
    occasion: { type: "text", label: "Повод", required: false, maxLen: 80 },
    postcard: { type: "boolean", label: "Открытка", required: false, default: false },
  },
  merchantSettingsSchema: {
    urgentDelivery: { type: "boolean", label: "Срочная доставка", required: false, default: true },
    postcards: { type: "boolean", label: "Открытки", required: false, default: true },
    packagingEnabled: { type: "boolean", label: "Упаковка", required: false, default: true },
  },
  orderOptionsSchema: {
    bouquetCount: {
      type: "select",
      label: "Количество роз",
      required: false,
      values: ["3", "5", "7", "11", "21", "51", "101"],
    },
    deliveryDate: { type: "date", label: "Дата доставки", required: false },
    postcardText: { type: "text", label: "Текст открытки", required: false, maxLen: 280 },
    packaging: { type: "select", label: "Упаковка", required: false, values: ["paper", "box"], default: "paper" },
    occasion: { type: "text", label: "Повод", required: false, maxLen: 80 },
  },
  merchantConfig: {
    sections: [
      { key: "urgentDelivery", title: "Срочная доставка", enabled: true },
      { key: "postcards", title: "Открытки", enabled: true },
      { key: "packaging", title: "Упаковка", enabled: true },
    ],
  },
  demoProducts: [
    {
      categoryKey: "bouquets",
      name: "Букет \"Весна\"",
      price: 1990,
      image: "https://picsum.photos/seed/flowers-bouquet/600/600",
      attributes: { bouquetType: "mixed", deliveryDate: "tomorrow" },
    },
    {
      categoryKey: "roses",
      name: "Розы 21 шт",
      price: 2490,
      image: "https://picsum.photos/seed/flowers-roses/600/600",
      attributes: { packaging: ["paper", "box"], postcard: true },
    },
  ],
};

