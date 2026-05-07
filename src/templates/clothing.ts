import { BusinessType } from "@prisma/client";
import type { BusinessTemplateConfig } from "./types.js";

export const clothingTemplate: BusinessTemplateConfig = {
  businessType: BusinessType.clothing,
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
    size: { type: "select", label: "Размер", required: true, values: ["S", "M", "L", "XL"] },
    color: { type: "text", label: "Цвет", required: true, maxLen: 40 },
    brand: { type: "text", label: "Бренд", required: false, maxLen: 60 },
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
  orderOptionsSchema: {
    size: { type: "select", label: "Размер", required: true, values: ["S", "M", "L", "XL"] },
    color: { type: "text", label: "Цвет", required: true, maxLen: 40 },
  },
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
};

