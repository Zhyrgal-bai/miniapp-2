import { useCallback, useEffect, useMemo, useState } from "react";
import { useBodyScrollLock } from "../../utils/bodyScrollLock";
import { ru } from "../../i18n/ru";
import { adminService } from "../../services/admin.service";
import { PRODUCT_SIZES } from "../../constants/productCatalog";
import { getNormalizedVariants } from "../../utils/product";
import { getProductImages } from "../../utils/product";
import { categoryRoots } from "../../utils/categoryTree";
import {
  schemaKeysFromProductSchema,
  stripProductAttributesToSchema,
} from "@repo-shared/productAttributeNormalization";
import type { Category, Product, Variant } from "../../types";
import {
  TierStockEditor,
} from "./TierStockEditor";
import {
  defaultTierRows,
  tierRowsToVariants,
  variantsToTierRows,
  type TierStockRow,
} from "./tierStockUtils";
import { DynamicFieldRenderer } from "./DynamicFieldRenderer";
import { useResolvedBusinessType } from "./useResolvedBusinessType";
import { AdminCategoryFields } from "./AdminCategoryFields";
import { resolveProductCategoryId } from "../../utils/resolveProductCategoryId";
import { formatAdminApiError } from "../../utils/adminApiError";
import {
  expandShortHex,
  isValidHexColor,
  lookupVariantHexByName,
  resolvePickerHex,
} from "../../utils/variantColor";

function normalizeProductAttributesForSchema(
  raw: unknown,
  schema: Record<string, unknown>,
): Record<string, unknown> {
  return stripProductAttributesToSchema(schemaKeysFromProductSchema(schema), raw)
    .value;
}

const SIZE_OPTIONS = PRODUCT_SIZES;
type SizeOption = (typeof SIZE_OPTIONS)[number];

type SizeRow = { enabled: boolean; stock: number | "" };

type VariantDraft = {
  sid: string;
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

function newSid() {
  return globalThis.crypto?.randomUUID?.() ?? `e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptySizes(): Record<SizeOption, SizeRow> {
  const sizes = {} as Record<SizeOption, SizeRow>;
  for (const s of SIZE_OPTIONS) {
    sizes[s] = { enabled: false, stock: "" };
  }
  return sizes;
}

function createEmptyVariant(): VariantDraft {
  return { sid: newSid(), colorName: "", colorHex: "#cccccc", sizes: emptySizes() };
}

function productToDrafts(p: Product): VariantDraft[] {
  const vv = getNormalizedVariants(p);
  if (vv.length === 0) {
    return [createEmptyVariant()];
  }
  return vv.map((v) => {
    const sizes = emptySizes();
    for (const s of v.sizes ?? []) {
      const key = s.size;
      if ((SIZE_OPTIONS as readonly string[]).includes(key)) {
        sizes[key as SizeOption] = { enabled: true, stock: s.stock };
      }
    }
    return {
      sid: newSid(),
      colorName: v.color,
      colorHex: resolvePickerHex(v),
      sizes,
    };
  });
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

type Props = {
  open: boolean;
  productId: number | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function ProductEditModal({
  open,
  productId,
  onClose,
  onSaved,
}: Props) {
  useBodyScrollLock(open);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [mainCategoryId, setMainCategoryId] = useState<number | "">("");
  const [subCategoryId, setSubCategoryId] = useState<number | "">("");
  const [isNew, setIsNew] = useState(false);
  const [isPopular, setIsPopular] = useState(false);
  const [isSale, setIsSale] = useState(false);
  const [discountPercent, setDiscountPercent] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [mainIdx, setMainIdx] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([
    createEmptyVariant(),
  ]);
  const [tierRows, setTierRows] = useState<TierStockRow[]>([]);
  const {
    businessType: merchantBusinessType,
    productSchema,
    showClothingVariants,
    showTierStock,
    resolved: businessTypeReady,
  } = useResolvedBusinessType();
  const [attributes, setAttributes] = useState<Record<string, unknown>>({});

  const rootCategories = useMemo(() => categoryRoots(categories), [categories]);

  const resetFromProduct = useCallback((p: Product) => {
    setName(p.name);
    setPrice(p.price);
    const subId = p.categoryId ?? p.category?.id ?? "";
    const parentId = p.category?.parentId ?? p.category?.parent?.id ?? "";
    setMainCategoryId(parentId);
    setSubCategoryId(subId);
    setIsNew(Boolean(p.isNew));
    setIsPopular(Boolean(p.isPopular));
    setIsSale(Boolean(p.isSale));
    setDiscountPercent(
      p.discountPercent != null && Number.isFinite(p.discountPercent)
        ? Math.min(100, Math.max(0, Math.round(Number(p.discountPercent))))
        : 0
    );
    setDescription(p.description ?? "");
    const imgs = getProductImages(p);
    setImages([...imgs]);
    setMainIdx(0);
    setVariantDrafts(productToDrafts(p));
    const bt = String(p.businessType ?? merchantBusinessType ?? "clothing");
    setTierRows(variantsToTierRows(bt, getNormalizedVariants(p)));
    setAttributes(normalizeProductAttributesForSchema(p.attributes, productSchema));
  }, [merchantBusinessType, productSchema]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const tree = await adminService.getCategories();
        setCategories(tree);
        const roots = categoryRoots(tree);
        setMainCategoryId((prev) => (prev === "" ? (roots[0]?.id ?? "") : prev));
        setSubCategoryId((prev) =>
          prev === "" ? (roots[0]?.children?.[0]?.id ?? "") : prev
        );
      } catch (e) {
        console.error(e);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open || !merchantBusinessType) return;
    if (productId == null) {
      setTierRows(defaultTierRows(merchantBusinessType));
    }
  }, [open, merchantBusinessType, productId]);

  useEffect(() => {
    if (!open || categories.length === 0 || mainCategoryId === "") return;
    const isRoot = rootCategories.some((r) => r.id === mainCategoryId);
    if (!isRoot) {
      const leaf = categories.find((c) => c.id === mainCategoryId);
      const parentId = leaf?.parentId ?? leaf?.parent?.id;
      if (parentId != null && rootCategories.some((r) => r.id === parentId)) {
        setMainCategoryId(parentId);
        return;
      }
      const fallback = rootCategories[0]?.id ?? "";
      setMainCategoryId(fallback);
      return;
    }
    const root = rootCategories.find((r) => r.id === mainCategoryId);
    const kids = root?.children ?? [];
    if (kids.length === 0) {
      setSubCategoryId("");
      return;
    }
    if (!kids.some((k) => k.id === subCategoryId)) {
      setSubCategoryId(kids[0]!.id);
    }
  }, [open, categories, mainCategoryId, rootCategories, subCategoryId]);

  useEffect(() => {
    if (!open || productId == null) {
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const p = await adminService.getProduct(productId);
        if (cancelled) return;
        resetFromProduct(p);
      } catch (e) {
        if (!cancelled) {
          setLoadError(formatAdminApiError(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, productId, resetFromProduct]);

  useEffect(() => {
    if (!open || Object.keys(productSchema).length === 0) return;
    setAttributes((prev) =>
      normalizeProductAttributesForSchema(prev, productSchema),
    );
  }, [open, productSchema]);

  const updateDraft = (
    sid: string,
    patch: Partial<Pick<VariantDraft, "colorName" | "colorHex">>
  ) => {
    setVariantDrafts((prev) =>
      prev.map((v) => (v.sid === sid ? { ...v, ...patch } : v))
    );
  };

  const setSizeEnabled = (sid: string, size: SizeOption, enabled: boolean) => {
    setVariantDrafts((prev) =>
      prev.map((v) => {
        if (v.sid !== sid) return v;
        const next = { ...v.sizes[size], enabled };
        if (!enabled) next.stock = "";
        return { ...v, sizes: { ...v.sizes, [size]: next } };
      })
    );
  };

  const setSizeStock = (sid: string, size: SizeOption, stock: number | "") => {
    setVariantDrafts((prev) =>
      prev.map((v) =>
        v.sid === sid
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
    setVariantDrafts((prev) => [...prev, createEmptyVariant()]);
  };

  const removeVariant = (sid: string) => {
    setVariantDrafts((prev) =>
      prev.length <= 1 ? prev : prev.filter((v) => v.sid !== sid)
    );
  };

  const removeImageAt = (index: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setMainIdx((m) => {
        if (next.length === 0) return 0;
        if (index === m) return 0;
        if (index < m) return Math.max(0, m - 1);
        return Math.min(m, next.length - 1);
      });
      return next;
    });
  };

  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    setSaveError(null);
    try {
      const urls = await adminService.uploadImages(Array.from(files));
      setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Ошибка загрузки изображений"
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (productId == null) return;
    setSaveError(null);

    const priceNum = typeof price === "number" ? price : Number(price);
    if (!name.trim() || !priceNum || priceNum <= 0) {
      setSaveError("Укажите название и цену.");
      return;
    }
    const disc = discountPercent === "" ? 0 : Number(discountPercent);
    if (!Number.isFinite(disc) || disc < 0 || disc > 100) {
      setSaveError("Скидка: от 0 до 100.");
      return;
    }
    if (images.length === 0) {
      setSaveError("Нужно хотя бы одно фото.");
      return;
    }
    const categoryId = resolveProductCategoryId(
      mainCategoryId,
      subCategoryId,
      rootCategories,
    );
    if (categoryId == null) {
      setSaveError(
        rootCategories.length === 0
          ? "Сначала создайте категорию."
          : "Выберите категорию или подкатегорию.",
      );
      return;
    }

    if (showClothingVariants) {
      for (let i = 0; i < variantDrafts.length; i++) {
        const d = variantDrafts[i];
        if (!d) continue;
        if (!d.colorName.trim()) {
          setSaveError(`Вариант ${i + 1}: укажите цвет (текст).`);
          return;
        }
        const enabled = SIZE_OPTIONS.filter((sz) => d.sizes[sz].enabled);
        if (enabled.length === 0) {
          setSaveError(`Вариант ${i + 1}: выберите размеры.`);
          return;
        }
        for (const sz of enabled) {
          const st = d.sizes[sz].stock;
          const n = typeof st === "number" ? st : Number(st);
          if (!Number.isFinite(n) || n <= 0) {
            setSaveError(`Вариант ${i + 1}: остаток для ${sz}.`);
            return;
          }
        }
      }
    }

    if (showTierStock) {
      const enabled = tierRows.filter((r) => r.enabled);
      if (enabled.length === 0) {
        setSaveError("Выберите хотя бы один вариант и укажите остаток.");
        return;
      }
      for (const row of enabled) {
        const n = typeof row.stock === "number" ? row.stock : Number(row.stock);
        if (!Number.isFinite(n) || n <= 0) {
          setSaveError(`Для «${row.label}» укажите количество больше нуля.`);
          return;
        }
      }
    }

    const ordered =
      images.length === 0
        ? []
        : (() => {
            const i = Math.min(Math.max(0, mainIdx), images.length - 1);
            const main = images[i];
            if (main === undefined) return images;
            return [main, ...images.filter((_, j) => j !== i)];
          })();

    setSaving(true);
    try {
      const basePatch = {
        name: name.trim(),
        price: Math.round(priceNum),
        categoryId,
        isNew,
        isPopular,
        isSale,
        discountPercent: Math.round(disc),
        description: description.trim(),
        images: ordered,
        image: ordered[0] ?? "",
      };
      if (showClothingVariants) {
        await adminService.updateProduct(productId, {
          ...basePatch,
          variants: buildVariantsForApi(variantDrafts) as Product["variants"],
        });
      } else if (showTierStock) {
        await adminService.updateProduct(productId, {
          ...basePatch,
          variants: tierRowsToVariants(tierRows) as unknown as Product["variants"],
          attributes: normalizeProductAttributesForSchema(attributes, productSchema),
        });
      } else {
        await adminService.updateProduct(productId, {
          ...basePatch,
          attributes: normalizeProductAttributesForSchema(attributes, productSchema),
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      setSaveError(formatAdminApiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (!open || productId == null) return null;

  return (
    <div
      className="admin-modal-overlay"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-edit-product-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="admin-modal__head">
          <h2 id="admin-edit-product-title" className="admin-modal__title">
            Редактирование товара
          </h2>
          <button
            type="button"
            className="admin-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="admin-modal__body">
          {loading && <p className="admin-dash-page__muted">Загрузка…</p>}
          {loadError && (
            <div className="admin-form-error" role="alert">
              {loadError}
            </div>
          )}
          {saveError && (
            <div className="admin-form-error" role="alert">
              {saveError}
            </div>
          )}

          {!loading && !loadError && (
            <>
              <div className="admin-form-section">
                <label className="admin-field-label" htmlFor="em-name">
                  Название
                </label>
                <input
                  id="em-name"
                  className="admin-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="admin-form-section admin-modal__row2">
                <div>
                  <label className="admin-field-label" htmlFor="em-price">
                    Цена (сом)
                  </label>
                  <input
                    id="em-price"
                    type="number"
                    className="admin-input"
                    min={1}
                    step={1}
                    value={price === "" ? "" : price}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPrice(v === "" ? "" : Number(v));
                    }}
                  />
                </div>
                <div>
                  <label className="admin-field-label" htmlFor="em-disc">
                    Скидка, %
                  </label>
                  <input
                    id="em-disc"
                    type="number"
                    className="admin-input"
                    min={0}
                    max={100}
                    step={1}
                    value={discountPercent === "" ? "" : discountPercent}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDiscountPercent(v === "" ? "" : Number(v));
                    }}
                  />
                </div>
              </div>
              <AdminCategoryFields
                categories={categories}
                mainCategoryId={mainCategoryId}
                subCategoryId={subCategoryId}
                onMainChange={setMainCategoryId}
                onSubChange={setSubCategoryId}
                mainSelectId="em-main-cat"
                subSelectId="em-sub-cat"
              />
              <div className="admin-form-section">
                <span className="admin-field-label">Фильтры</span>
                <div className="admin-sizes">
                  <label className="admin-size-chip">
                    <input
                      type="checkbox"
                      checked={isNew}
                      onChange={(e) => setIsNew(e.target.checked)}
                    />
                    <span className="admin-size-chip-text">{ru.admin.sizeNew}</span>
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
              <div className="admin-form-section">
                <label className="admin-field-label" htmlFor="em-desc">
                  Описание
                </label>
                <textarea
                  id="em-desc"
                  className="admin-input admin-textarea"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="admin-form-section">
                <span className="admin-field-label">Фотографии</span>
                <p className="admin-form-hint">
                  Отметьте главное фото. Можно удалить лишние и добавить новые
                  (Cloudinary).
                </p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="admin-input"
                  disabled={uploading}
                  onChange={(e) => void handleAddFiles(e)}
                />
                {uploading && (
                  <p className="admin-form-hint">Загрузка…</p>
                )}
                <div className="admin-pm-gallery">
                  {images.map((src, idx) => (
                    <div key={`${src}-${idx}`} className="admin-pm-gallery__item">
                      <img src={src} alt="" />
                      <label className="admin-pm-gallery__main">
                        <input
                          type="radio"
                          name="main-photo"
                          checked={mainIdx === idx}
                          onChange={() => setMainIdx(idx)}
                        />
                        <span>Главное</span>
                      </label>
                      <button
                        type="button"
                        className="admin-pm-gallery__remove"
                        onClick={() => removeImageAt(idx)}
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-form-divider" />

              <DynamicFieldRenderer
                schema={productSchema}
                value={attributes}
                onChange={setAttributes}
              />

              {showTierStock && businessTypeReady ? (
                <TierStockEditor
                  businessType={merchantBusinessType}
                  rows={tierRows}
                  onChange={setTierRows}
                />
              ) : null}

              {showClothingVariants && businessTypeReady && (
                <>
                  <p className="admin-form-hint">
                    Варианты: цвет (палитра + название) и остатки
                  </p>

                  {variantDrafts.map((draft, index) => (
                    <div key={draft.sid} className="admin-variant">
                      <div className="admin-variant-head">
                        <span className="admin-variant-title">Вариант {index + 1}</span>
                        {variantDrafts.length > 1 && (
                          <button
                            type="button"
                            className="admin-variant-remove"
                            onClick={() => removeVariant(draft.sid)}
                          >
                            Удалить вариант
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
                              updateDraft(draft.sid, { colorHex: e.target.value })
                            }
                          />
                          <input
                            id={`em-c-${draft.sid}`}
                            className="admin-input admin-color-name-input"
                            placeholder="например: светло-серый"
                            value={draft.colorName}
                            onChange={(e) => {
                              const next = e.target.value;
                              const mapped = lookupVariantHexByName(next);
                              updateDraft(draft.sid, {
                                colorName: next,
                                ...(mapped ? { colorHex: mapped } : {}),
                              });
                            }}
                          />
                        </div>
                        <div className="admin-color-presets" role="group" aria-label="Быстрый выбор цвета">
                          {COLOR_PRESETS.map((p) => (
                            <button
                              key={p.name}
                              type="button"
                              className="admin-color-preset-btn"
                              onClick={() =>
                                updateDraft(draft.sid, {
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
                                  setSizeEnabled(draft.sid, size, e.target.checked)
                                }
                              />
                              <span className="admin-size-chip-text">{size}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="admin-stock-block">
                        <span className="admin-field-label">Остаток</span>
                        {SIZE_OPTIONS.filter((sz) => draft.sizes[sz].enabled).length ===
                        0 ? (
                          <p className="admin-stock-placeholder">Отметьте размеры</p>
                        ) : (
                          SIZE_OPTIONS.filter((sz) => draft.sizes[sz].enabled).map(
                            (size) => (
                              <div key={size} className="admin-stock-row">
                                <span className="admin-stock-size">{size}</span>
                                <input
                                  type="number"
                                  className="admin-input"
                                  min={0}
                                  value={
                                    draft.sizes[size].stock === ""
                                      ? ""
                                      : draft.sizes[size].stock
                                  }
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setSizeStock(
                                      draft.sid,
                                      size,
                                      v === "" ? "" : Number(v)
                                    );
                                  }}
                                />
                              </div>
                            )
                          )
                        )}
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="admin-secondary-btn"
                    onClick={addVariant}
                  >
                    + Добавить вариант
                  </button>
                </>
              )}
            </>
          )}
        </div>

        <div className="admin-modal__foot">
          <button
            type="button"
            className="admin-secondary-btn"
            onClick={onClose}
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="button"
            className="admin-submit-btn"
            onClick={() => void handleSave()}
            disabled={loading || !!loadError || saving}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
