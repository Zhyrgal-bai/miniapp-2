import { useEffect, useMemo, useState } from "react";
import type { Product } from "../types";
import {
  getLineStock,
  getNormalizedVariants,
  isOutOfStock,
} from "../utils/product";
import {
  labelPrimaryOption,
  verticalProfileFor,
  verticalUsesColorAxis,
} from "@repo-shared/businessCommerce";

export type VerticalSelection = {
  selectedSize: string | null;
  selectedColor: string | null;
  lineColor: string;
  sizes: Array<{ size: string; stock: number }>;
  hasCustomColors: boolean;
  outOfStock: boolean;
  selectedStock: number;
  canSelect: boolean;
  primaryLabel: string;
  secondaryLabel: string | null;
  showColorPicker: boolean;
};

export function useVerticalProductSelection(
  product: Product,
  businessType?: string | null,
  options?: {
    autoSelectDefaults?: boolean;
    merchantConfig?: Record<string, unknown> | null;
  },
): VerticalSelection & {
  setSelectedSize: (s: string | null) => void;
  setSelectedColor: (s: string | null) => void;
} {
  const autoSelectDefaults = options?.autoSelectDefaults !== false;
  const merchantConfig = options?.merchantConfig ?? null;
  const profile = useMemo(
    () => verticalProfileFor(businessType ?? product.businessType, merchantConfig),
    [businessType, product.businessType, merchantConfig],
  );
  const showColorPicker = verticalUsesColorAxis(
    businessType ?? product.businessType,
    merchantConfig,
  );

  const variants = useMemo(() => getNormalizedVariants(product), [product]);

  const hasCustomColors = showColorPicker && variants.some((v) => v.color && v.color !== "default");

  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSize(null);
    setSelectedColor(null);
  }, [product.id]);

  useEffect(() => {
    if (!showColorPicker) {
      if (autoSelectDefaults) setSelectedColor("default");
      return;
    }
    if (!variants.length) return;
    if (!autoSelectDefaults) return;
    setSelectedColor((prev) => {
      if (prev && variants.some((x) => x.color === prev)) return prev;
      return variants[0]?.color ?? "default";
    });
  }, [product.id, variants, showColorPicker, autoSelectDefaults]);

  const sizes = useMemo(() => {
    if (!variants.length) return [];
    const v = showColorPicker
      ? variants.find((x) => x.color === (selectedColor ?? "default")) ?? variants[0]
      : variants[0];
    return v?.sizes ?? [];
  }, [variants, selectedColor, showColorPicker]);

  useEffect(() => {
    if (!autoSelectDefaults) return;
    if (sizes.length === 0) {
      setSelectedSize(null);
      return;
    }
    setSelectedSize((prev) => {
      if (prev && sizes.some((s) => s.size === prev && s.stock > 0)) return prev;
      const firstAvailable = sizes.find((s) => s.stock > 0);
      return firstAvailable?.size ?? sizes[0]?.size ?? null;
    });
  }, [product.id, sizes, autoSelectDefaults]);

  const lineColor = showColorPicker
    ? (selectedColor ?? variants[0]?.color ?? "default")
    : "default";

  const outOfStock = isOutOfStock(product);
  const selectedStock =
    selectedSize != null
      ? getLineStock(product, selectedSize, lineColor)
      : 0;

  const canSelect = !outOfStock && selectedSize != null && selectedStock > 0;

  return {
    selectedSize,
    selectedColor,
    setSelectedSize,
    setSelectedColor,
    lineColor,
    sizes,
    hasCustomColors,
    outOfStock,
    selectedStock,
    canSelect,
    primaryLabel: profile.primaryAxisLabel,
    secondaryLabel: profile.secondaryAxisLabel,
    showColorPicker,
  };
}

export function formatSizeLabel(businessType: string | null | undefined, size: string): string {
  return labelPrimaryOption(businessType, size);
}
