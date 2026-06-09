/**
 * Shared vertical CRM preference extractor (Phase 15.5).
 *
 * Single extractor for all 8 verticals — driven by option keys, not duplicated
 * per-vertical branches. Reuses the existing RU label maps from
 * `businessCommerce.ts` so CRM displays match storefront/order summaries.
 */

import {
  ADDON_RU,
  HOT_OR_COLD_RU,
  MILK_RU,
  PACKAGING_RU,
  SKIN_TYPE_RU,
  SPICY_RU,
  SUGAR_RU,
  SYRUP_RU,
  labelPrimaryOption,
} from "./businessCommerce.js";

/** Order line shape needed for preference extraction. */
export type CustomerPrefOrderItem = {
  size?: string | null;
  color?: string | null;
  options?: Record<string, unknown> | null;
};

export type CustomerPreference = {
  /** Option key or pseudo-key (`size`, `color`). */
  key: string;
  /** Human label for the preference group, e.g. "Молоко". */
  label: string;
  /** Most frequent raw value. */
  value: string;
  /** Human label for the value, e.g. "Соевое". */
  valueLabel: string;
  /** Times the customer chose this value. */
  count: number;
};

const KEY_LABELS: Record<string, string> = {
  size: "Размер",
  color: "Цвет",
  hotOrCold: "Температура",
  milk: "Молоко",
  sugar: "Сахар",
  syrups: "Сиропы",
  spicy: "Острота",
  addons: "Добавки",
  combo: "Комбо",
  packaging: "Упаковка",
  occasion: "Повод",
  postcardText: "Открытка",
  deliveryDate: "Дата доставки",
  vin: "VIN",
  oem: "OEM",
  orderNote: "Заметка",
  skinType: "Тип кожи",
  shade: "Оттенок",
  assemblyRequired: "Сборка",
  deliveryPreference: "Доставка",
  memory: "Память",
};

const VALUE_LABEL_MAPS: Record<string, Record<string, string>> = {
  hotOrCold: HOT_OR_COLD_RU,
  milk: MILK_RU,
  sugar: SUGAR_RU,
  syrups: SYRUP_RU,
  spicy: SPICY_RU,
  addons: ADDON_RU,
  packaging: PACKAGING_RU,
  skinType: SKIN_TYPE_RU,
};

/** Option keys that are relevant for CRM per vertical (others are ignored). */
const VERTICAL_PREF_KEYS: Record<string, string[]> = {
  coffee: ["size", "hotOrCold", "milk", "sugar", "syrups"],
  fastfood: ["size", "combo", "spicy", "addons"],
  flowers: ["size", "occasion", "packaging"],
  clothing: ["size", "color"],
  electronics: ["size", "color", "memory"],
  autoparts: ["vin", "oem"],
  cosmetics: ["shade", "skinType", "color"],
  furniture: ["assemblyRequired", "deliveryPreference", "color"],
};

function labelValue(
  businessType: string | null | undefined,
  key: string,
  rawValue: string,
): string {
  const value = String(rawValue ?? "").trim();
  if (value === "") return value;
  const map = VALUE_LABEL_MAPS[key];
  if (map && map[value]) return map[value];
  if (key === "size") return labelPrimaryOption(businessType, value) || value;
  if (key === "combo") return value === "true" ? "Комбо" : value;
  if (key === "assemblyRequired") return value === "true" ? "Нужна сборка" : "Без сборки";
  return value;
}

function pushValue(
  counts: Map<string, Map<string, number>>,
  key: string,
  value: string,
): void {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "") return;
  let inner = counts.get(key);
  if (inner == null) {
    inner = new Map<string, number>();
    counts.set(key, inner);
  }
  inner.set(trimmed, (inner.get(trimmed) ?? 0) + 1);
}

/**
 * Extract a customer's favorite vertical preferences from their order items.
 * Returns the most frequent value per relevant key for the vertical.
 */
export function extractVerticalPreferences(
  businessType: string | null | undefined,
  items: CustomerPrefOrderItem[],
): CustomerPreference[] {
  const vertical = String(businessType ?? "").trim().toLowerCase();
  const relevantKeys = VERTICAL_PREF_KEYS[vertical] ?? ["size", "color"];
  const relevant = new Set(relevantKeys);

  const counts = new Map<string, Map<string, number>>();

  for (const item of items) {
    if (relevant.has("size") && item.size) pushValue(counts, "size", item.size);
    if (relevant.has("color") && item.color) pushValue(counts, "color", item.color);

    const options =
      item.options != null && typeof item.options === "object" && !Array.isArray(item.options)
        ? (item.options as Record<string, unknown>)
        : {};
    for (const key of relevantKeys) {
      if (key === "size" || key === "color") continue;
      const raw = options[key];
      if (raw == null) continue;
      if (Array.isArray(raw)) {
        for (const v of raw) pushValue(counts, key, String(v));
      } else if (typeof raw === "boolean") {
        if (raw) pushValue(counts, key, "true");
      } else {
        pushValue(counts, key, String(raw));
      }
    }
  }

  const prefs: CustomerPreference[] = [];
  for (const key of relevantKeys) {
    const inner = counts.get(key);
    if (inner == null || inner.size === 0) continue;
    let bestValue = "";
    let bestCount = 0;
    for (const [value, count] of inner.entries()) {
      if (count > bestCount) {
        bestCount = count;
        bestValue = value;
      }
    }
    if (bestValue === "") continue;
    prefs.push({
      key,
      label: KEY_LABELS[key] ?? key,
      value: bestValue,
      valueLabel: labelValue(businessType, key, bestValue),
      count: bestCount,
    });
  }

  return prefs;
}
