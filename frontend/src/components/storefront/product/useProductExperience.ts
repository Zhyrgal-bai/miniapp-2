import { useCallback, useEffect, useMemo, useState } from "react";
import type { Product, ProductColor } from "../../../types";
import { api } from "../../../services/api";
import { useCartStore } from "../../../store/useCartStore";
import {
  getDiscountPercent,
  getEffectivePrice,
  getPrimaryImage,
} from "../../../utils/product";
import { getMaxOrderQty } from "../../../commerce/quantityPolicy";
import { getVariantCssBackground } from "../../../utils/variantColor";
import { useVerticalProductSelection } from "../../../commerce/useVerticalProductSelection";
import {
  cartLineIdentityKey,
  storageColorForCart,
} from "../../../commerce/cartLineIdentity";
import { recordRecentlyViewed } from "../discovery/recentlyViewed";
import { trackAddToCart } from "../../../services/storefrontAnalytics";
import {
  productRequiresVariantPicker,
  resolveInstantAddLine,
} from "../../../commerce/productVariantPolicy";
import {
  rememberVerticalPreset,
  resolveVerticalPresetBySchema,
} from "../../../storefront/customerAutofillStorage";

export type ProductExperienceState = {
  display: Product;
  loadingDetail: boolean;
  images: string[];
  colors: ProductColor[];
  orderOptions: Record<string, unknown>;
  setOrderOptions: (v: Record<string, unknown>) => void;
  pickQty: number;
  setPickQty: (fn: (q: number) => number) => void;
  selectionHint: string | null;
  selectedSize: string | null;
  setSelectedSize: (s: string | null) => void;
  selectedColor: string | null;
  setSelectedColor: (s: string | null) => void;
  sizes: Array<{ size: string; stock: number }>;
  hasCustomColors: boolean;
  outOfStock: boolean;
  selectedStock: number;
  primaryLabel: string;
  showColorPicker: boolean;
  discountPct: number;
  displayPrice: number;
  selectionReady: boolean;
  maxPickQty: number;
  addToCartDisabled: boolean;
  validateSelection: () => boolean;
  handleAddToCart: () => boolean;
  cartQuantity: number;
  clearSelectionHint: () => void;
};

export function useProductExperience(opts: {
  product: Product;
  businessId: number;
  businessType?: string | null;
  merchantConfig?: Record<string, unknown> | null;
  orderOptionsSchema?: Record<string, unknown> | null;
}): ProductExperienceState {
  const {
    product,
    businessId,
    businessType,
    merchantConfig,
    orderOptionsSchema = null,
  } = opts;
  const [resolved, setResolved] = useState<Product | null>(null);
  const [pickQty, setPickQtyState] = useState(1);
  const [selectionHint, setSelectionHint] = useState<string | null>(null);
  const [orderOptions, setOrderOptions] = useState<Record<string, unknown>>({});

  const display =
    resolved != null && resolved.id === product.id ? resolved : product;
  const loadingDetail = resolved == null && product.id != null;

  useEffect(() => {
    const nextOrderOptions = resolveVerticalPresetBySchema(
      businessId,
      businessType ?? product.businessType ?? null,
      orderOptionsSchema,
    );
    setResolved(null);
    setPickQtyState(1);
    setSelectionHint(null);
    setOrderOptions(nextOrderOptions);
    const id = product.id;
    if (!Number.isFinite(id) || !id) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get<Product>(`/products/${id}`);
        if (!cancelled && res.data?.id === id) setResolved(res.data);
      } catch {
        if (!cancelled) setResolved(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product.id, businessId, businessType, product.businessType, orderOptionsSchema]);

  const resolvedBusinessType =
    businessType ?? display.businessType ?? null;

  const requiresVariantPicker = productRequiresVariantPicker(
    display,
    resolvedBusinessType,
    merchantConfig,
  );

  const selection = useVerticalProductSelection(display, resolvedBusinessType, {
    autoSelectDefaults: !requiresVariantPicker,
    merchantConfig,
  });

  const {
    selectedSize,
    selectedColor,
    setSelectedSize,
    setSelectedColor,
    lineColor,
    sizes,
    hasCustomColors,
    outOfStock,
    selectedStock,
    primaryLabel,
    showColorPicker,
  } = selection;

  const colors: ProductColor[] = useMemo(() => {
    if (!showColorPicker) return [];
    if (display.colors && display.colors.length > 0) return display.colors;
    if (display.variants && display.variants.length > 0) {
      return display.variants.map((v) => ({
        name: v.color,
        hex: getVariantCssBackground(v),
      }));
    }
    return [];
  }, [display, showColorPicker]);

  const images = useMemo(() => {
    const raw =
      display.images && display.images.length > 0
        ? display.images
        : display.image
          ? [display.image]
          : [];
    return raw.filter((src) => typeof src === "string" && src.trim() !== "");
  }, [display]);

  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const items = useCartStore((s) => s.items);

  const storageColor = storageColorForCart(resolvedBusinessType, lineColor);

  const activeLine = useMemo(() => {
    if (selectedSize != null) {
      return { size: selectedSize, color: storageColor };
    }
    return resolveInstantAddLine(display, resolvedBusinessType, merchantConfig);
  }, [selectedSize, storageColor, display, resolvedBusinessType]);

  const cartItem = useMemo(() => {
    if (!activeLine) return null;
    const probe = {
      productId: display.id!,
      size: activeLine.size,
      color: activeLine.color,
      options: orderOptions,
    };
    const key = cartLineIdentityKey(probe);
    return items.find((i) => cartLineIdentityKey(i) === key) ?? null;
  }, [items, display.id, activeLine, orderOptions]);

  const cartQuantity = cartItem?.quantity ?? 0;
  const discountPct = getDiscountPercent(display);
  const displayPrice = getEffectivePrice(display);

  const selectionReady =
    !outOfStock &&
    activeLine != null &&
    (requiresVariantPicker
      ? selectedSize != null &&
        selectedStock > 0 &&
        (!showColorPicker || !hasCustomColors || selectedColor != null)
      : true);

  const maxPickQty =
    selectionReady && selectedStock > 0
      ? Math.max(1, selectedStock - cartQuantity)
      : activeLine
        ? Math.max(1, getMaxOrderQty(display, activeLine.size, activeLine.color) - cartQuantity)
        : 1;

  const addToCartDisabled = outOfStock || !selectionReady;

  const upsertQuantity = useCallback(
    (nextQuantity: number) => {
      const line = activeLine ?? resolveInstantAddLine(display, resolvedBusinessType, merchantConfig);
      if (!line || outOfStock) return;
      if (requiresVariantPicker) {
        if (showColorPicker && hasCustomColors && selectedColor == null) return;
        if (selectedSize == null || selectedStock <= 0) return;
      }
      if (cartItem) removeItem(cartItem);
      if (nextQuantity <= 0) return;
      const stock =
        selectedSize != null
          ? selectedStock
          : getMaxOrderQty(display, line.size, line.color);
      const capped = Math.min(nextQuantity, Math.max(stock, 1));
      addItem({
        productId: display.id!,
        name: display.name,
        price: displayPrice,
        image: getPrimaryImage(display),
        size: line.size,
        color: line.color,
        options: { ...orderOptions },
        quantity: capped,
      });
      if (businessId && display.id) trackAddToCart(businessId, display.id);
    },
    [
      activeLine,
      outOfStock,
      requiresVariantPicker,
      showColorPicker,
      hasCustomColors,
      selectedColor,
      selectedSize,
      selectedStock,
      cartItem,
      removeItem,
      addItem,
      display,
      displayPrice,
      orderOptions,
      businessId,
      resolvedBusinessType,
    ],
  );

  const validateSelection = useCallback((): boolean => {
    if (outOfStock) return false;
    if (showColorPicker && hasCustomColors && selectedColor == null) {
      setSelectionHint("Выберите цвет");
      return false;
    }
    if (selectedSize == null && sizes.length > 0) {
      setSelectionHint(`Выберите ${primaryLabel.toLowerCase()}`);
      return false;
    }
    if (selectedStock <= 0) {
      setSelectionHint("Нет в наличии для выбранного варианта");
      return false;
    }
    setSelectionHint(null);
    return true;
  }, [
    outOfStock,
    showColorPicker,
    hasCustomColors,
    selectedColor,
    selectedSize,
    sizes.length,
    primaryLabel,
    selectedStock,
  ]);

  const handleAddToCart = useCallback((): boolean => {
    if (!validateSelection()) return false;
    recordRecentlyViewed({ businessId, product: display });
    const stock =
      selectedSize != null && selectedStock > 0
        ? selectedStock
        : activeLine
          ? getMaxOrderQty(display, activeLine.size, activeLine.color)
          : 0;
    const next = cartQuantity > 0 ? cartQuantity + pickQty : pickQty;
    upsertQuantity(Math.min(next, stock || next));
    return true;
  }, [
    validateSelection,
    businessId,
    display,
    selectedSize,
    selectedStock,
    activeLine,
    cartQuantity,
    pickQty,
    upsertQuantity,
  ]);

  const setPickQty = useCallback((fn: (q: number) => number) => {
    setPickQtyState((q) => fn(q));
  }, []);

  const clearSelectionHint = useCallback(() => setSelectionHint(null), []);

  useEffect(() => {
    if (Object.keys(orderOptions).length === 0) return;
    rememberVerticalPreset(
      businessId,
      resolvedBusinessType ?? display.businessType ?? null,
      orderOptions,
    );
  }, [businessId, resolvedBusinessType, display.businessType, orderOptions]);

  return {
    display,
    loadingDetail,
    images,
    colors,
    orderOptions,
    setOrderOptions,
    pickQty,
    setPickQty,
    selectionHint,
    selectedSize,
    setSelectedSize,
    selectedColor,
    setSelectedColor,
    sizes,
    hasCustomColors,
    outOfStock,
    selectedStock,
    primaryLabel,
    showColorPicker,
    discountPct,
    displayPrice,
    selectionReady,
    maxPickQty,
    addToCartDisabled,
    validateSelection,
    handleAddToCart,
    cartQuantity,
    clearSelectionHint,
  };
}

export function getRelatedProducts(
  product: Product,
  catalog: Product[],
  limit = 10,
): Product[] {
  const pid = Number(product.id ?? 0);
  const catId = product.categoryId;
  if (!catId) return [];
  return catalog
    .filter((p) => Number(p.id ?? 0) !== pid && Number(p.categoryId) === Number(catId))
    .sort((a, b) => (Number(b.sold ?? 0) || 0) - (Number(a.sold ?? 0) || 0))
    .slice(0, limit);
}
