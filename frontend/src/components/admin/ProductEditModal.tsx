import { useCallback, useEffect, useMemo, useState } from "react";
import { useBodyScrollLock } from "../../utils/bodyScrollLock";
import { ru } from "../../i18n/ru";
import { adminService } from "../../services/admin.service";
import { getNormalizedVariants } from "../../utils/product";
import { getProductImages } from "../../utils/product";
import { categoryRoots } from "../../utils/categoryTree";
import {
  schemaKeysFromProductSchema,
  stripProductAttributesToSchema,
} from "@repo-shared/productAttributeNormalization";
import type { Category, Product, ProductImageMeta, ProductStatus } from "../../types";
import { DynamicVariantEditor } from "./DynamicVariantEditor";
import { ClothingVariantEditor } from "./ClothingVariantEditor";
import {
  buildClothingVariantsForApi,
  createEmptyColorVariant,
  productToColorDrafts,
  validateClothingColorDrafts,
  type ClothingColorDraft,
} from "./clothingVariantUtils";
import {
  defaultOptionRowsForCreate,
  optionRowsToVariants,
  validateOptionRows,
  variantsToOptionRows,
  type VariantOptionRow,
} from "./variantEditorUtils";
import { verticalProfileFor } from "@repo-shared/businessCommerce";
import { DynamicFieldRenderer } from "./DynamicFieldRenderer";
import { useResolvedBusinessType } from "./useResolvedBusinessType";
import { AdminCategoryFields } from "./AdminCategoryFields";
import { resolveProductCategoryId } from "../../utils/resolveProductCategoryId";
import { formatAdminApiError } from "../../utils/adminApiError";

function normalizeProductAttributesForSchema(
  raw: unknown,
  schema: Record<string, unknown>,
): Record<string, unknown> {
  return stripProductAttributesToSchema(schemaKeysFromProductSchema(schema), raw)
    .value;
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
  const [imagesMeta, setImagesMeta] = useState<ProductImageMeta[]>([]);
  const [mainIdx, setMainIdx] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [colorDrafts, setColorDrafts] = useState<ClothingColorDraft[]>([
    createEmptyColorVariant(),
  ]);
  const [optionRows, setOptionRows] = useState<VariantOptionRow[]>(
    defaultOptionRowsForCreate(),
  );
  const {
    businessType: merchantBusinessType,
    productSchema,
    merchantConfig,
    showClothingVariants,
    showTierStock,
    showDynamicVariantEditor,
    resolved: businessTypeReady,
  } = useResolvedBusinessType();
  const [attributes, setAttributes] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState<ProductStatus>("ACTIVE");

  const rootCategories = useMemo(() => categoryRoots(categories), [categories]);

  const resetFromProduct = useCallback((p: Product) => {
    setName(p.name);
    setPrice(p.price);
    setStatus(p.status ?? "ACTIVE");
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
    setImagesMeta(Array.isArray(p.imagesMeta) ? [...p.imagesMeta] : []);
    setMainIdx(0);
    setColorDrafts(productToColorDrafts(p));
    const bt = String(p.businessType ?? merchantBusinessType ?? "clothing");
    setOptionRows(variantsToOptionRows(bt, getNormalizedVariants(p)));
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

  const removeImageAt = (index: number) => {
    setImages((prev) => {
      const removedUrl = prev[index];
      const next = prev.filter((_, i) => i !== index);
      if (removedUrl) {
        setImagesMeta((meta) => meta.filter((m) => m.url !== removedUrl));
      }
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
      const assets = await adminService.uploadImages(Array.from(files));
      setImages((prev) => [...prev, ...assets.map((a) => a.url)]);
      setImagesMeta((prev) => [...prev, ...assets.filter((a) => a.publicId)]);
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
      const clothingErr = validateClothingColorDrafts(colorDrafts);
      if (clothingErr) {
        setSaveError(clothingErr);
        return;
      }
    }

    if (showTierStock) {
      const axis = verticalProfileFor(merchantBusinessType, merchantConfig).primaryAxisLabel;
      const tierErr = validateOptionRows(optionRows, axis);
      if (tierErr) {
        setSaveError(tierErr);
        return;
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

    const orderedMeta = ordered
      .map((url) => imagesMeta.find((m) => m.url === url))
      .filter((m): m is ProductImageMeta => m != null);

    setSaving(true);
    try {
      const basePatch = {
        name: name.trim(),
        price: Math.round(priceNum),
        categoryId,
        status,
        isNew,
        isPopular,
        isSale,
        discountPercent: Math.round(disc),
        description: description.trim(),
        images: ordered,
        image: ordered[0] ?? "",
        imagesMeta: orderedMeta,
      };
      if (showClothingVariants) {
        await adminService.updateProduct(productId, {
          ...basePatch,
          variants: buildClothingVariantsForApi(colorDrafts) as Product["variants"],
        });
      } else if (showTierStock) {
        await adminService.updateProduct(productId, {
          ...basePatch,
          variants: optionRowsToVariants(optionRows) as unknown as Product["variants"],
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
                <label className="admin-field-label" htmlFor="em-status">
                  Статус
                </label>
                <select
                  id="em-status"
                  className="admin-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProductStatus)}
                >
                  <option value="ACTIVE">Активен (на витрине)</option>
                  <option value="DRAFT">Черновик</option>
                  <option value="ARCHIVED">В архиве</option>
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

              {showDynamicVariantEditor && !showClothingVariants && businessTypeReady ? (
                <DynamicVariantEditor
                  businessType={merchantBusinessType}
                  merchantConfig={merchantConfig}
                  rows={optionRows}
                  onChange={setOptionRows}
                />
              ) : null}

              {showClothingVariants && businessTypeReady ? (
                <ClothingVariantEditor drafts={colorDrafts} onChange={setColorDrafts} />
              ) : null}
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
