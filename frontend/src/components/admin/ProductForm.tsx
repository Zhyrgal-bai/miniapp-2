import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAdminStore } from "../../store/admin.store";
import { adminService } from "../../services/admin.service";
import { PRODUCT_SIZES } from "../../constants/productCatalog";
import type { Category, Product, Variant } from "../../types";
import { categoryRoots } from "../../utils/categoryTree";
import {
  expandShortHex,
  isValidHexColor,
  lookupVariantHexByName,
} from "../../utils/variantColor";
const SIZE_OPTIONS = PRODUCT_SIZES;
type SizeOption = (typeof SIZE_OPTIONS)[number];

type SizeRow = {
  enabled: boolean;
  stock: number | "";
};

type VariantDraft = {
  id: string;
  colorName: string;
  colorHex: string;
  sizes: Record<SizeOption, SizeRow>;
};

const COLOR_PRESETS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: "черный", hex: "#000000" },
  { name: "белый", hex: "#ffffff" },
  { name: "серый", hex: "#808080" },
  { name: "молочный", hex: "#fff8e7" },
  { name: "темно-синий", hex: "#00008b" },
];

function newVariantId() {
  return globalThis.crypto?.randomUUID?.() ?? `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createVariantDraft(): VariantDraft {
  const sizes = {} as Record<SizeOption, SizeRow>;
  for (const s of SIZE_OPTIONS) {
    sizes[s] = { enabled: false, stock: "" };
  }
  return {
    id: newVariantId(),
    colorName: "Чёрный",
    colorHex: "#000000",
    sizes,
  };
}

function buildVariantsForApi(drafts: VariantDraft[]): Variant[] {
  return drafts.map((d) => {
    const name = d.colorName.trim();
    let hex = d.colorHex.trim();
    if (!isValidHexColor(hex)) {
      hex = lookupVariantHexByName(name) ?? "#cccccc";
    } else {
      hex = expandShortHex(hex);
    }
    const sizes = SIZE_OPTIONS.filter((sz) => d.sizes[sz].enabled).map((sz) => {
      const st = d.sizes[sz].stock;
      const stock = typeof st === "number" && !Number.isNaN(st) ? st : 0;
      return { size: sz, stock };
    });
    return {
      color: { name, hex },
      sizes,
    } as unknown as Variant;
  });
}

const ProductForm = () => {
  const { addProduct } = useAdminStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mainCategoryId, setMainCategoryId] = useState<number | "">("");
  const [subCategoryId, setSubCategoryId] = useState<number | "">("");
  const [isNew, setIsNew] = useState(false);
  const [isPopular, setIsPopular] = useState(false);
  const [isSale, setIsSale] = useState(false);
  const [discountPercent, setDiscountPercent] = useState<number | "">("");
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([
    createVariantDraft(),
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  const rootCategories = useMemo(() => categoryRoots(categories), [categories]);

  useEffect(() => {
    void (async () => {
      try {
        const tree = await adminService.getCategories();
        setCategories(tree);
        const roots = categoryRoots(tree);
        const firstMain = roots[0];
        const firstSub = firstMain?.children?.[0];
        setMainCategoryId(firstMain?.id ?? "");
        setSubCategoryId(firstSub?.id ?? "");
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  useEffect(() => {
    if (categories.length === 0 || mainCategoryId === "") return;
    const root = rootCategories.find((r) => r.id === mainCategoryId);
    const kids = root?.children ?? [];
    if (kids.length === 0) {
      setSubCategoryId("");
      return;
    }
    if (!kids.some((k) => k.id === subCategoryId)) {
      setSubCategoryId(kids[0]!.id);
    }
  }, [categories, mainCategoryId, rootCategories, subCategoryId]);

  const updateDraft = (
    id: string,
    patch: Partial<Pick<VariantDraft, "colorName" | "colorHex">>
  ) => {
    setVariantDrafts((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...patch } : v))
    );
  };

  const setSizeEnabled = (variantId: string, size: SizeOption, enabled: boolean) => {
    setVariantDrafts((prev) =>
      prev.map((v) => {
        if (v.id !== variantId) return v;
        const next = { ...v.sizes[size], enabled };
        if (!enabled) next.stock = "";
        return {
          ...v,
          sizes: { ...v.sizes, [size]: next },
        };
      })
    );
  };

  const setSizeStock = (variantId: string, size: SizeOption, stock: number | "") => {
    setVariantDrafts((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? {
              ...v,
              sizes: {
                ...v.sizes,
                [size]: { ...v.sizes[size], stock },
              },
            }
          : v
      )
    );
  };

  const addVariant = () => {
    setVariantDrafts((prev) => [...prev, createVariantDraft()]);
  };

  const removeVariant = (id: string) => {
    setVariantDrafts((prev) =>
      prev.length <= 1 ? prev : prev.filter((v) => v.id !== id)
    );
  };

  const handleImageFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploadingImages(true);
    setFormError(null);
    try {
      const next = [...imageUrls];
      for (const file of Array.from(files)) {
        const url = await adminService.uploadImage(file);
        next.push(url);
      }
      setImageUrls(next);
    } catch (err) {
      console.error(err);
      setFormError(
        err instanceof Error ? err.message : "Не удалось загрузить изображение"
      );
    } finally {
      setUploadingImages(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const priceNum = typeof price === "number" ? price : Number(price);
    if (!name.trim() || !priceNum || priceNum <= 0) {
      setFormError("Укажите название и цену больше нуля.");
      return;
    }

    const disc =
      discountPercent === "" ? 0 : Number(discountPercent);
    if (!Number.isFinite(disc) || disc < 0 || disc > 100) {
      setFormError("Скидка: число от 0 до 100.");
      return;
    }

    if (imageUrls.length === 0) {
      setFormError("Загрузите хотя бы одно изображение.");
      return;
    }

    for (let i = 0; i < variantDrafts.length; i++) {
      const d = variantDrafts[i];
      if (!d) continue;
      if (!d.colorName.trim()) {
        setFormError(`Вариант ${i + 1}: укажите название цвета (текст).`);
        return;
      }
      const enabled = SIZE_OPTIONS.filter((sz) => d.sizes[sz].enabled);
      if (enabled.length === 0) {
        setFormError(`Вариант ${i + 1}: выберите хотя бы один размер.`);
        return;
      }
      for (const sz of enabled) {
        const st = d.sizes[sz].stock;
        const n = typeof st === "number" ? st : Number(st);
        if (!Number.isFinite(n) || n <= 0) {
          setFormError(`Вариант ${i + 1}: для размера ${sz} укажите количество больше нуля.`);
          return;
        }
      }
    }

    const variants = buildVariantsForApi(variantDrafts);

    if (!subCategoryId) {
      setFormError("Выберите подкатегорию.");
      return;
    }

    const data = {
      name: name.trim(),
      price: priceNum,
      image: imageUrls[0] ?? "",
      images: imageUrls,
      categoryId: Number(subCategoryId),
      isNew,
      isPopular,
      isSale,
      discountPercent: disc,
      description: description.trim(),
      variants,
    };

    try {
      await addProduct(data as Product);
      setFormError(null);
      setName("");
      setDescription("");
      setPrice("");
      setImageUrls([]);
      setDiscountPercent("");
      setIsNew(false);
      setIsPopular(false);
      setIsSale(false);
      setVariantDrafts([createVariantDraft()]);
      alert("Товар добавлен ✅");
    } catch (err) {
      console.error(err);
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setFormError("Нет прав");
        return;
      }
      if (err instanceof Error && err.message.includes("Telegram")) {
        setFormError(err.message);
        return;
      }
      setFormError("Не удалось сохранить товар. Проверьте сеть и попробуйте снова.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      {formError && (
        <div className="admin-form-error" role="alert">
          {formError}
        </div>
      )}

      <div className="admin-form-section">
        <label className="admin-field-label" htmlFor="pf-name">
          Название
        </label>
        <input
          id="pf-name"
          placeholder="Название товара"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="admin-input"
          autoComplete="off"
        />
      </div>

      <div className="admin-form-section">
        <label className="admin-field-label" htmlFor="pf-desc">
          Описание
        </label>
        <textarea
          id="pf-desc"
          className="admin-input admin-textarea"
          rows={4}
          placeholder="Описание товара"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="admin-form-section">
        <label className="admin-field-label" htmlFor="pf-price">
          Цена (сом)
        </label>
        <input
          id="pf-price"
          type="number"
          inputMode="decimal"
          min={0}
          step={1}
          placeholder="Цена"
          value={price === "" ? "" : price}
          onChange={(e) => {
            const v = e.target.value;
            setPrice(v === "" ? "" : Number(v));
          }}
          className="admin-input"
        />
      </div>

      <div className="admin-form-section">
        <label className="admin-field-label" htmlFor="pf-discount">
          Скидка, %
        </label>
        <input
          id="pf-discount"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          placeholder="0"
          value={discountPercent === "" ? "" : discountPercent}
          onChange={(e) => {
            const v = e.target.value;
            setDiscountPercent(v === "" ? "" : Number(v));
          }}
          className="admin-input"
        />
      </div>

      <div className="admin-form-section">
        <label className="admin-field-label" htmlFor="pf-images">
          Изображения
        </label>
        <input
          id="pf-images"
          type="file"
          accept="image/*"
          multiple
          className="admin-input"
          disabled={uploadingImages}
          onChange={(e) => void handleImageFiles(e)}
        />
        {uploadingImages && (
          <p className="admin-form-hint">Загрузка в Cloudinary…</p>
        )}
        {imageUrls.length > 0 && (
          <div className="admin-multi-preview">
            {imageUrls.map((src) => (
              <img key={src} src={src} alt="" className="image-preview" />
            ))}
          </div>
        )}
      </div>

      <div className="admin-form-section">
        <label className="admin-field-label" htmlFor="pf-main-category">
          Категория
        </label>
        <select
          id="pf-main-category"
          className="admin-select"
          value={mainCategoryId}
          onChange={(e) => {
            const nextMainId = Number(e.target.value);
            setMainCategoryId(nextMainId);
            const nextMain = rootCategories.find((c) => c.id === nextMainId);
            setSubCategoryId(nextMain?.children?.[0]?.id ?? "");
          }}
        >
          {rootCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="admin-form-section">
        <label className="admin-field-label" htmlFor="pf-sub-category">
          Подкатегория
        </label>
        <select
          id="pf-sub-category"
          className="admin-select"
          value={subCategoryId}
          onChange={(e) => {
            const v = e.target.value;
            setSubCategoryId(v === "" ? "" : Number(v));
          }}
        >
          <option value="">Выберите подкатегорию</option>
          {(rootCategories.find((c) => c.id === mainCategoryId)?.children ?? []).map(
            (c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            )
          )}
        </select>
      </div>
      <div className="admin-form-section">
        <span className="admin-field-label">Фильтры</span>
        <div className="admin-sizes">
          <label className="admin-size-chip">
            <input
              type="checkbox"
              checked={isNew}
              onChange={(e) => setIsNew(e.target.checked)}
            />
            <span className="admin-size-chip-text">NEW</span>
          </label>
          <label className="admin-size-chip">
            <input
              type="checkbox"
              checked={isPopular}
              onChange={(e) => setIsPopular(e.target.checked)}
            />
            <span className="admin-size-chip-text">POPULAR</span>
          </label>
          <label className="admin-size-chip">
            <input
              type="checkbox"
              checked={isSale}
              onChange={(e) => setIsSale(e.target.checked)}
            />
            <span className="admin-size-chip-text">SALE</span>
          </label>
        </div>
      </div>

      <div className="admin-form-divider" />

      <p className="admin-form-hint">Цвета и остатки по размерам (можно несколько вариантов)</p>

      {variantDrafts.map((draft, index) => (
          <div key={draft.id} className="admin-variant">
            <div className="admin-variant-head">
              <span className="admin-variant-title">Вариант {index + 1}</span>
              {variantDrafts.length > 1 && (
                <button
                  type="button"
                  className="admin-variant-remove"
                  onClick={() => removeVariant(draft.id)}
                  aria-label="Удалить вариант"
                >
                  Удалить
                </button>
              )}
            </div>

            <div className="admin-form-section">
              <span className="admin-field-label">Цвет</span>
              <div className="admin-color-picker-row">
                <input
                  type="color"
                  className="admin-color-native"
                  aria-label={`Цвет варианта ${index + 1}`}
                  value={
                    isValidHexColor(draft.colorHex)
                      ? expandShortHex(draft.colorHex)
                      : "#cccccc"
                  }
                  onChange={(e) =>
                    updateDraft(draft.id, { colorHex: e.target.value })
                  }
                />
                <input
                  id={`pf-color-${draft.id}`}
                  className="admin-input admin-color-name-input"
                  placeholder="например: светло-серый"
                  value={draft.colorName}
                  onChange={(e) => {
                    const next = e.target.value;
                    const mapped = lookupVariantHexByName(next);
                    updateDraft(draft.id, {
                      colorName: next,
                      ...(mapped ? { colorHex: mapped } : {}),
                    });
                  }}
                  autoComplete="off"
                />
              </div>
              <div className="admin-color-presets" role="group" aria-label="Быстрый выбор цвета">
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className="admin-color-preset-btn"
                    onClick={() =>
                      updateDraft(draft.id, {
                        colorName: p.name,
                        colorHex: p.hex,
                      })
                    }
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-form-section">
              <span className="admin-field-label">Размеры</span>
              <div className="admin-sizes">
                {SIZE_OPTIONS.map((size) => (
                  <label key={size} className="admin-size-chip">
                    <input
                      type="checkbox"
                      checked={draft.sizes[size].enabled}
                      onChange={(e) =>
                        setSizeEnabled(draft.id, size, e.target.checked)
                      }
                    />
                    <span className="admin-size-chip-text">{size}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="admin-stock-block">
              <span className="admin-field-label">Остаток по размеру</span>
              {SIZE_OPTIONS.filter((sz) => draft.sizes[sz].enabled).length === 0 ? (
                <p className="admin-stock-placeholder">Отметьте размеры выше</p>
              ) : (
                SIZE_OPTIONS.filter((sz) => draft.sizes[sz].enabled).map((size) => (
                  <div key={size} className="admin-stock-row">
                    <span className="admin-stock-size">{size}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="Количество"
                      value={
                        draft.sizes[size].stock === ""
                          ? ""
                          : draft.sizes[size].stock
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        setSizeStock(
                          draft.id,
                          size,
                          v === "" ? "" : Number(v)
                        );
                      }}
                      className="admin-input"
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        ))}

      <button type="button" onClick={addVariant} className="admin-secondary-btn">
        + Добавить цвет
      </button>

      <button type="submit" className="admin-submit-btn">
        Добавить товар
      </button>
    </form>
  );
};

export default ProductForm;
