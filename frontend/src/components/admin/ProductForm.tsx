import { showSuccessToast } from "../../store/toast.store";
import { useEffect, useMemo, useState } from "react";
import { useAdminStore } from "../../store/admin.store";
import { adminService } from "../../services/admin.service";
import type { Category, Product, Variant } from "../../types";
import { categoryRoots } from "../../utils/categoryTree";
import { DynamicFieldRenderer } from "./DynamicFieldRenderer";
import { DynamicVariantEditor } from "./DynamicVariantEditor";
import { ClothingVariantEditor } from "./ClothingVariantEditor";
import {
  buildClothingVariantsForApi,
  createEmptyColorVariant,
  validateClothingColorDrafts,
  type ClothingColorDraft,
} from "./clothingVariantUtils";
import {
  defaultOptionRowsForCreate,
  optionRowsToVariants,
  validateOptionRows,
  type VariantOptionRow,
} from "./variantEditorUtils";
import { verticalProfileFor } from "@repo-shared/businessCommerce";
import { useResolvedBusinessType } from "./useResolvedBusinessType";
import { AdminCategoryFields } from "./AdminCategoryFields";
import { resolveProductCategoryId } from "../../utils/resolveProductCategoryId";
import { formatAdminApiError } from "../../utils/adminApiError";
import {
  schemaKeysFromProductSchema,
  stripProductAttributesToSchema,
} from "@repo-shared/productAttributeNormalization";
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
  const [attributes, setAttributes] = useState<Record<string, unknown>>({});
  const {
    businessType: merchantBusinessType,
    productSchema,
    showClothingVariants,
    showTierStock,
    resolved: businessTypeReady,
  } = useResolvedBusinessType();
  const [colorDrafts, setColorDrafts] = useState<ClothingColorDraft[]>([
    createEmptyColorVariant(),
  ]);
  const [optionRows, setOptionRows] = useState<VariantOptionRow[]>(
    defaultOptionRowsForCreate(),
  );
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
    if (!merchantBusinessType) return;
    setOptionRows(defaultOptionRowsForCreate());
  }, [merchantBusinessType]);

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

    if (showClothingVariants) {
      const clothingErr = validateClothingColorDrafts(colorDrafts);
      if (clothingErr) {
        setFormError(clothingErr);
        return;
      }
    }

    if (showTierStock) {
      const axis = verticalProfileFor(merchantBusinessType).primaryAxisLabel;
      const tierErr = validateOptionRows(optionRows, axis);
      if (tierErr) {
        setFormError(tierErr);
        return;
      }
    }

    const variants = showClothingVariants
      ? buildClothingVariantsForApi(colorDrafts)
      : showTierStock
        ? (optionRowsToVariants(optionRows) as unknown as Variant[])
        : ([] as Variant[]);

    const categoryId = resolveProductCategoryId(
      mainCategoryId,
      subCategoryId,
      rootCategories,
    );
    if (categoryId == null) {
      setFormError(
        rootCategories.length === 0
          ? "Сначала создайте категорию."
          : "Выберите категорию или подкатегорию.",
      );
      return;
    }

    const data = {
      name: name.trim(),
      price: priceNum,
      image: imageUrls[0] ?? "",
      images: imageUrls,
      categoryId,
      isNew,
      isPopular,
      isSale,
      discountPercent: disc,
      description: description.trim(),
      variants,
      attributes: stripProductAttributesToSchema(
        schemaKeysFromProductSchema(productSchema),
        attributes,
      ).value,
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
      setColorDrafts([createEmptyColorVariant()]);
      setOptionRows(defaultOptionRowsForCreate());
      setAttributes({});
      showSuccessToast("Товар добавлен");
    } catch (err) {
      console.error(err);
      setFormError(formatAdminApiError(err));
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

      <AdminCategoryFields
        categories={categories}
        mainCategoryId={mainCategoryId}
        subCategoryId={subCategoryId}
        onMainChange={setMainCategoryId}
        onSubChange={setSubCategoryId}
        mainSelectId="pf-main-category"
        subSelectId="pf-sub-category"
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

      <DynamicFieldRenderer
        schema={productSchema}
        value={attributes}
        onChange={setAttributes}
      />

      {showClothingVariants && businessTypeReady ? (
        <>
          <div className="admin-form-divider" />
          <ClothingVariantEditor drafts={colorDrafts} onChange={setColorDrafts} />
        </>
      ) : null}

      {showTierStock && businessTypeReady ? (
        <DynamicVariantEditor
          businessType={merchantBusinessType}
          rows={optionRows}
          onChange={setOptionRows}
        />
      ) : null}

      <button type="submit" className="admin-submit-btn">
        Добавить товар
      </button>
    </form>
  );
};

export default ProductForm;
