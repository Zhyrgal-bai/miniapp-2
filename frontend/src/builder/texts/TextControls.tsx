import React from "react";

function readString(obj: unknown, key: string, fallback: string): string {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return fallback;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

export type StorefrontTextConfig = {
  heroDefaultTitle: string;
  heroDefaultSubtitle: string;
  heroDefaultCta: string;
  addToCartLabel: string;
  buyNowLabel: string;
  viewAllLabel: string;
  checkoutLabel: string;

  titleCategories: string;
  titleHits: string;
  titleTrending: string;
  titleFaq: string;
  titleReviews: string;

  emptyCartTitle: string;
  emptyCartHint: string;
  emptyCatalogTitle: string;
  emptyCatalogHint: string;
  emptySearchTitle: string;
  emptySearchHint: string;

  menuShopLabel: string;
  menuCartLabel: string;
  menuOrdersLabel: string;
  menuFaqLabel: string;
};

export function TextControls(props: {
  value: unknown;
  onChange: (next: StorefrontTextConfig) => void;
}): React.ReactElement {
  const current: StorefrontTextConfig = {
    heroDefaultTitle: readString(props.value, "heroDefaultTitle", "Добро пожаловать"),
    heroDefaultSubtitle: readString(props.value, "heroDefaultSubtitle", ""),
    heroDefaultCta: readString(props.value, "heroDefaultCta", ""),
    addToCartLabel: readString(props.value, "addToCartLabel", "Добавить"),
    buyNowLabel: readString(props.value, "buyNowLabel", "Купить"),
    viewAllLabel: readString(props.value, "viewAllLabel", "Смотреть всё"),
    checkoutLabel: readString(props.value, "checkoutLabel", "Оформить"),

    titleCategories: readString(props.value, "titleCategories", "Категории"),
    titleHits: readString(props.value, "titleHits", "Хиты"),
    titleTrending: readString(props.value, "titleTrending", "Trending"),
    titleFaq: readString(props.value, "titleFaq", "FAQ"),
    titleReviews: readString(props.value, "titleReviews", "Отзывы"),

    emptyCartTitle: readString(props.value, "emptyCartTitle", "Корзина пуста"),
    emptyCartHint: readString(props.value, "emptyCartHint", "Добавьте товары, чтобы оформить заказ"),
    emptyCatalogTitle: readString(props.value, "emptyCatalogTitle", "Нет товаров"),
    emptyCatalogHint: readString(props.value, "emptyCatalogHint", "Скоро появятся товары"),
    emptySearchTitle: readString(props.value, "emptySearchTitle", "Ничего не найдено"),
    emptySearchHint: readString(props.value, "emptySearchHint", "Смените категорию или поиск"),

    menuShopLabel: readString(props.value, "menuShopLabel", "Магазин"),
    menuCartLabel: readString(props.value, "menuCartLabel", "Корзина"),
    menuOrdersLabel: readString(props.value, "menuOrdersLabel", "Мои заказы"),
    menuFaqLabel: readString(props.value, "menuFaqLabel", "FAQ"),
  };

  const inputStyle: React.CSSProperties = {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(2,6,23,0.45)",
    color: "#fff",
    padding: "8px 10px",
  };

  const groupTitleStyle: React.CSSProperties = {
    fontWeight: 900,
    opacity: 0.85,
    fontSize: 12,
    marginTop: 4,
  };

  const field = (key: keyof StorefrontTextConfig, label: string, placeholder?: string) => (
    <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
      {label}
      <input
        defaultValue={String(current[key] ?? "")}
        placeholder={placeholder}
        onBlur={(e) =>
          props.onChange({
            ...current,
            [key]: e.target.value,
          })
        }
        style={inputStyle}
      />
    </label>
  );

  return (
    <div style={{ padding: 12, display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 900, opacity: 0.92, fontSize: 12 }}>Тексты витрины</div>

      <div style={groupTitleStyle}>Hero</div>
      {field("heroDefaultTitle", "Title (по умолчанию)", "Добро пожаловать")}
      {field("heroDefaultSubtitle", "Subtitle (по умолчанию)", "")}
      {field("heroDefaultCta", "CTA (по умолчанию)", "")}

      <div style={groupTitleStyle}>Section titles</div>
      {field("titleCategories", "Категории")}
      {field("titleHits", "Хиты")}
      {field("titleTrending", "Trending")}
      {field("titleFaq", "FAQ")}
      {field("titleReviews", "Отзывы")}

      <div style={groupTitleStyle}>Buttons</div>
      {field("addToCartLabel", "Добавить")}
      {field("buyNowLabel", "Купить")}
      {field("viewAllLabel", "Смотреть всё")}
      {field("checkoutLabel", "Оформить")}

      <div style={groupTitleStyle}>Empty states</div>
      {field("emptyCartTitle", "Корзина пуста — заголовок")}
      {field("emptyCartHint", "Корзина пуста — текст")}
      {field("emptyCatalogTitle", "Нет товаров — заголовок")}
      {field("emptyCatalogHint", "Нет товаров — текст")}
      {field("emptySearchTitle", "Ничего не найдено — заголовок")}
      {field("emptySearchHint", "Ничего не найдено — текст")}

      <div style={groupTitleStyle}>Menu labels</div>
      {field("menuShopLabel", "Магазин")}
      {field("menuCartLabel", "Корзина")}
      {field("menuOrdersLabel", "Заказы")}
      {field("menuFaqLabel", "FAQ")}

      <div style={{ opacity: 0.7, fontSize: 12 }}>
        Эти тексты сохраняются <b>per-магазин</b> и применяются на витрине сразу в preview.
      </div>
    </div>
  );
}

