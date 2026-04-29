export interface Size {
  id?: number;
  size: string;
  stock: number;
}

export interface Variant {
  id?: number;
  /** Название оттенка (как в БД). */
  color: string;
  /** Явный HEX с палитры / color picker; если null — подбираем по названию. */
  colorHex?: string | null;
  sizes: Size[];
}

export interface Category {
  id: number;
  name: string;
  parentId?: number | null;
  parent?: Category | null;
  children?: Category[];
  productsCount?: number;
}

/** Цвет в новой модели (опционально, вместе с `sizes`). */
export interface ProductColor {
  name: string;
  hex: string;
}

export interface Product {
  id?: number;
  name: string;
  price: number;
  image: string;

  images?: string[];
  colors?: ProductColor[];
  sizes?: Size[];

  /** Продано единиц (аналитика). */
  sold?: number;

  description?: string;
  categoryId?: number;
  category?: Category;
  isNew?: boolean;
  isPopular?: boolean;
  isSale?: boolean;

  /** Скидка в процентах 0–100 от поля `price`. */
  discountPercent?: number;

  /** Легаси с API: варианты по цвету с размерами. */
  variants?: Variant[];
}
