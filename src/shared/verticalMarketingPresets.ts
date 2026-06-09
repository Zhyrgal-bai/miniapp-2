/**
 * Vertical marketing presets (Phase 16.5) — pure, deterministic.
 *
 * One schema-driven registry of suggested promotions/campaigns per business
 * vertical. Reuses the canonical vertical id set; no per-vertical branching in
 * consumers. Presets are starting points the merchant can instantiate; they do
 * not auto-apply at checkout.
 */

import type { BusinessTypeId } from "./businessTypes.js";
import type { PromotionType } from "./promotionEngine.js";

export type VerticalMarketingPreset = {
  key: string;
  title: string;
  description: string;
  promotionType: PromotionType;
  /** Suggested percent for percent-type presets. */
  suggestedPercent?: number;
  /** Suggested audience segment hint (CRM). */
  audienceHint?:
    | "best"
    | "high_value"
    | "frequent"
    | "returning"
    | "recent"
    | "inactive"
    | null;
};

const PRESETS: Record<BusinessTypeId, VerticalMarketingPreset[]> = {
  flowers: [
    { key: "flowers_holiday", title: "Праздничная акция", description: "Скидка к 8 марта / 14 февраля", promotionType: "PERCENT", suggestedPercent: 10 },
    { key: "flowers_birthday", title: "Напоминание о дне рождения", description: "Персональное предложение постоянным", promotionType: "COUPON_PERCENT", suggestedPercent: 15, audienceHint: "returning" },
  ],
  coffee: [
    { key: "coffee_card", title: "Кофейная карта", description: "Каждый 6-й напиток в подарок", promotionType: "BUY_X_GET_Y" },
    { key: "coffee_morning", title: "Утренняя акция", description: "Скидка до 11:00", promotionType: "PERCENT", suggestedPercent: 15 },
  ],
  fastfood: [
    { key: "fastfood_lunch", title: "Ланч-комбо", description: "Комбо по будням", promotionType: "FIXED" },
    { key: "fastfood_weekend", title: "Выходные предложения", description: "Скидка на выходных", promotionType: "PERCENT", suggestedPercent: 10 },
  ],
  clothing: [
    { key: "clothing_season", title: "Сезонная распродажа", description: "Смена коллекции", promotionType: "PERCENT", suggestedPercent: 20 },
    { key: "clothing_welcome", title: "Приветственная скидка", description: "Для новых покупателей", promotionType: "COUPON_PERCENT", suggestedPercent: 10, audienceHint: "recent" },
  ],
  electronics: [
    { key: "electronics_bundle", title: "Комплект со скидкой", description: "Аксессуар в подарок", promotionType: "GIFT" },
    { key: "electronics_freedelivery", title: "Бесплатная доставка", description: "От суммы заказа", promotionType: "FREE_DELIVERY" },
  ],
  autoparts: [
    { key: "autoparts_service", title: "Напоминание о ТО", description: "Возврат клиентов на сервис", promotionType: "COUPON_PERCENT", suggestedPercent: 10, audienceHint: "inactive" },
    { key: "autoparts_bundle", title: "Набор для ТО", description: "Скидка на комплект", promotionType: "PERCENT", suggestedPercent: 12 },
  ],
  cosmetics: [
    { key: "cosmetics_beauty", title: "Бьюти-акция", description: "Подарок к покупке", promotionType: "GIFT" },
    { key: "cosmetics_vip", title: "VIP предложение", description: "Лучшим клиентам", promotionType: "COUPON_PERCENT", suggestedPercent: 15, audienceHint: "best" },
  ],
  furniture: [
    { key: "furniture_delivery", title: "Доставка в подарок", description: "Бесплатная доставка от суммы", promotionType: "FREE_DELIVERY" },
    { key: "furniture_season", title: "Сезонное обновление", description: "Скидка на коллекцию", promotionType: "PERCENT", suggestedPercent: 15 },
  ],
  universal: [
    { key: "universal_welcome", title: "Приветственная скидка", description: "Для новых клиентов", promotionType: "COUPON_PERCENT", suggestedPercent: 10, audienceHint: "recent" },
    { key: "universal_winback", title: "Возврат клиентов", description: "Для неактивных покупателей", promotionType: "COUPON_PERCENT", suggestedPercent: 12, audienceHint: "inactive" },
  ],
};

const FALLBACK: VerticalMarketingPreset[] = PRESETS.universal;

export function verticalMarketingPresets(
  businessType: string | null | undefined,
): VerticalMarketingPreset[] {
  const key = String(businessType ?? "").trim().toLowerCase() as BusinessTypeId;
  return PRESETS[key] ?? FALLBACK;
}

export function hasVerticalMarketingPresets(businessType: string | null | undefined): boolean {
  const key = String(businessType ?? "").trim().toLowerCase();
  return key in PRESETS;
}
