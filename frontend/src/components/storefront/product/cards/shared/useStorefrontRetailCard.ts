import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "../../../../../types";
import { useCartStore } from "../../../../../store/useCartStore";
import {
  getDiscountPercent,
  getEffectivePrice,
  getPrimaryImage,
  isOutOfStock,
} from "../../../../../utils/product";
import { getMaxOrderQty } from "../../../../../commerce/quantityPolicy";
import {
  findCartLineForSelection,
  storageColorForCart,
} from "../../../../../commerce/cartLineIdentity";
import {
  productRequiresVariantPicker,
  resolveInstantAddLine,
} from "../../../../../commerce/productVariantPolicy";
import { verticalCatalogCtaLabel } from "../../../../../storefront/verticalExperience";
import { isStorefrontCommerceEnabled } from "../../../../../hooks/useStorefrontCommerceMode";
import { useStorefrontPayload } from "../../../runtime/StorefrontPayloadContext";
import { recordRecentlyViewed } from "../../../discovery/recentlyViewed";
import { trackAddToCart, trackProductView } from "../../../../../services/storefrontAnalytics";
import { normalizeRetailCardConfig } from "./normalizeRetailCardConfig";

function readTextConfigString(cfg: unknown, key: string): string {
  if (cfg == null || typeof cfg !== "object" || Array.isArray(cfg)) return "";
  const v = (cfg as Record<string, unknown>)[key];
  return typeof v === "string" ? v : "";
}

export type UseStorefrontRetailCardOptions = {
  product: Product;
  showToast: (msg: string) => void;
  onOpenDetail?: (product: Product) => void;
  cardConfig?: Record<string, unknown>;
  textConfig?: Record<string, unknown>;
  businessId?: number;
  businessType?: string;
  selectedSize?: string | null;
  selectedColor?: string | null;
  lineColor?: string | null;
  needsVariantPickerOverride?: boolean;
};

export function useStorefrontRetailCard(opts: UseStorefrontRetailCardOptions) {
  const {
    product,
    showToast,
    onOpenDetail,
    cardConfig,
    textConfig,
    businessId,
    businessType,
    selectedSize: externalSize = null,
    selectedColor: externalColor = null,
    lineColor: externalLineColor = null,
    needsVariantPickerOverride,
  } = opts;

  const commerceEnabled = isStorefrontCommerceEnabled();
  const { payload } = useStorefrontPayload();
  const cfg = useMemo(() => normalizeRetailCardConfig(cardConfig), [cardConfig]);
  const customAddLabel = readTextConfigString(textConfig, "addToCartLabel").trim();

  const merchantConfig =
    payload?.merchantConfig != null &&
    typeof payload.merchantConfig === "object" &&
    !Array.isArray(payload.merchantConfig)
      ? (payload.merchantConfig as Record<string, unknown>)
      : null;

  const resolvedBusinessType =
    businessType ?? product.businessType ?? payload?.businessType ?? null;

  const outOfStock = isOutOfStock(product);
  const needsVariantPicker =
    needsVariantPickerOverride ??
    productRequiresVariantPicker(product, resolvedBusinessType, merchantConfig);

  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const images = useMemo(() => {
    const raw =
      product.images && product.images.length > 0 ? product.images : [product.image];
    return raw.filter((u) => typeof u === "string" && u.trim() !== "");
  }, [product]);

  const primaryCatalogImage = images[0] ?? product.image;
  const catalogHasMultiplePhotos = images.length > 1;

  const storefrontCtaLabel = useMemo(() => {
    if (customAddLabel !== "") return customAddLabel;
    return verticalCatalogCtaLabel(resolvedBusinessType, {
      outOfStock,
      needsVariantPicker,
    });
  }, [customAddLabel, resolvedBusinessType, outOfStock, needsVariantPicker]);

  const lineColor = externalLineColor ?? "default";

  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const items = useCartStore((state) => state.items);

  useEffect(() => {
    setCurrentIndex(0);
  }, [product.id]);

  useEffect(() => {
    setCurrentIndex((i) => (images.length === 0 ? 0 : Math.min(i, images.length - 1)));
  }, [images.length]);

  const selectedStock = useMemo(() => {
    if (!externalSize || lineColor === null) return 0;
    return getMaxOrderQty(product, externalSize, lineColor);
  }, [externalSize, lineColor, product]);

  const storageColor = storageColorForCart(resolvedBusinessType, lineColor);

  const cartItem = useMemo(() => {
    if (product.id == null) return null;

    const instant = !needsVariantPicker
      ? resolveInstantAddLine(product, resolvedBusinessType, merchantConfig)
      : null;

    return findCartLineForSelection(items, {
      productId: product.id,
      size: externalSize,
      storageColor,
      needsVariantPicker,
      businessType: resolvedBusinessType,
      instantLine: instant,
    });
  }, [
    items,
    product,
    externalSize,
    storageColor,
    needsVariantPicker,
    resolvedBusinessType,
    merchantConfig,
  ]);

  const quantity = cartItem?.quantity ?? 0;

  const activeLineStock = useMemo(() => {
    if (cartItem) {
      return getMaxOrderQty(product, cartItem.size, cartItem.color ?? null);
    }
    if (!needsVariantPicker) {
      const instant = resolveInstantAddLine(product, resolvedBusinessType, merchantConfig);
      if (instant) return getMaxOrderQty(product, instant.size, instant.color);
    }
    return selectedStock;
  }, [
    cartItem,
    needsVariantPicker,
    product,
    resolvedBusinessType,
    merchantConfig,
    selectedStock,
  ]);

  const discountPct = getDiscountPercent(product);
  const displayPrice = getEffectivePrice(product);

  const upsertQuantity = useCallback(
    (nextQuantity: number) => {
      const instant =
        !needsVariantPicker
          ? resolveInstantAddLine(product, resolvedBusinessType, merchantConfig)
          : null;
      const size = instant?.size ?? externalSize;
      const colorKey = instant?.color ?? lineColor;
      if (!size || outOfStock || colorKey === null) return;
      const stock = getMaxOrderQty(product, size, colorKey);
      if (stock <= 0) return;

      const storage = storageColorForCart(resolvedBusinessType, colorKey);

      if (cartItem) removeItem(cartItem);
      if (nextQuantity <= 0) return;

      const capped = Math.min(nextQuantity, stock);
      addItem({
        productId: product.id!,
        name: product.name,
        price: displayPrice,
        image: getPrimaryImage(product),
        size,
        color: storage,
        quantity: capped,
      });
      if (businessId && product.id) {
        trackAddToCart(businessId, product.id);
      }
    },
    [
      needsVariantPicker,
      product,
      resolvedBusinessType,
      merchantConfig,
      externalSize,
      lineColor,
      outOfStock,
      cartItem,
      removeItem,
      addItem,
      displayPrice,
      businessId,
    ],
  );

  const canAddToCart = useMemo(() => {
    if (needsVariantPicker) return false;
    const instant = resolveInstantAddLine(product, resolvedBusinessType, merchantConfig);
    if (instant) {
      return !outOfStock && getMaxOrderQty(product, instant.size, instant.color) > 0;
    }
    return (
      !outOfStock &&
      externalSize !== null &&
      selectedStock > 0 &&
      lineColor !== null
    );
  }, [
    needsVariantPicker,
    product,
    resolvedBusinessType,
    merchantConfig,
    outOfStock,
    externalSize,
    selectedStock,
    lineColor,
  ]);

  const openDetail = useCallback(() => {
    if (businessId && product.id) {
      recordRecentlyViewed({ businessId, product });
      trackProductView(businessId, product.id);
    }
    onOpenDetail?.(product);
  }, [businessId, product, onOpenDetail]);

  const handleAddToCart = useCallback(() => {
    if (needsVariantPicker && onOpenDetail) {
      openDetail();
      return;
    }
    if (!canAddToCart) return;
    const instant = resolveInstantAddLine(product, resolvedBusinessType, merchantConfig);
    if (instant) {
      if (businessId && product.id) recordRecentlyViewed({ businessId, product });
      upsertQuantity(1);
      showToast("Добавлено в корзину");
      return;
    }
    if (lineColor === null) return;
    if (businessId && product.id) recordRecentlyViewed({ businessId, product });
    upsertQuantity(1);
    showToast("Добавлено в корзину");
  }, [
    needsVariantPicker,
    onOpenDetail,
    openDetail,
    canAddToCart,
    product,
    resolvedBusinessType,
    merchantConfig,
    businessId,
    upsertQuantity,
    showToast,
    lineColor,
  ]);

  const handleIncrement = useCallback(() => {
    if (quantity >= activeLineStock) return;
    upsertQuantity(quantity + 1);
  }, [quantity, activeLineStock, upsertQuantity]);

  const handleDecrement = useCallback(() => {
    upsertQuantity(quantity - 1);
  }, [quantity, upsertQuantity]);

  const atMaxQty = quantity >= activeLineStock && activeLineStock > 0;
  const canAdjustQty =
    quantity > 0 && !outOfStock && (externalSize != null || !needsVariantPicker);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null || images.length <= 1) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const threshold = 40;
      if (dx < -threshold) {
        setCurrentIndex((i) => Math.min(i + 1, images.length - 1));
      } else if (dx > threshold) {
        setCurrentIndex((i) => Math.max(i - 1, 0));
      }
      touchStartX.current = null;
    },
    [images.length],
  );

  return {
    cfg,
    commerceEnabled,
    payload,
    outOfStock,
    needsVariantPicker,
    images,
    primaryCatalogImage,
    catalogHasMultiplePhotos,
    currentIndex,
    storefrontCtaLabel,
    discountPct,
    displayPrice,
    quantity,
    canAdjustQty,
    atMaxQty,
    openDetail,
    handleAddToCart,
    handleIncrement,
    handleDecrement,
    handleTouchStart,
    handleTouchEnd,
    resolvedBusinessType,
    externalSize,
    externalColor,
  };
}
