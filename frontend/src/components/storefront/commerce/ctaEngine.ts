import type { Product } from "../../../types";
import type { BusinessBehaviorProfile, StorefrontKitId } from "./businessBehaviorProfiles";

export type CtaModel = {
  label: string;
  sublabel?: string;
  disabled: boolean;
  emphasis: "primary" | "neutral" | "ghost";
  state:
    | "out_of_stock"
    | "select_options"
    | "ready"
    | "in_cart"
    | "low_stock"
    | "popular";
};

export function computeCtaModel(params: {
  product: Product;
  profile: BusinessBehaviorProfile;
  kit: StorefrontKitId;
  addLabelOverride?: string | null;
  outOfStock: boolean;
  selectionComplete: boolean;
  inCartQty: number;
  stockLeft: number | null; // best-effort
  soldScore: number; // best-effort (e.g. sold30d)
}): CtaModel {
  const { profile } = params;
  const labels = profile.cta.labels;

  if (params.outOfStock) {
    return {
      label: labels.outOfStock,
      disabled: true,
      emphasis: "ghost",
      state: "out_of_stock",
    };
  }

  if (!params.selectionComplete) {
    return {
      label: labels.selectOptions,
      sublabel: labels.add,
      disabled: true,
      emphasis: "neutral",
      state: "select_options",
    };
  }

  const low =
    params.stockLeft != null &&
    params.stockLeft > 0 &&
    params.stockLeft <= profile.cta.lowStockThreshold;

  const popular = params.soldScore >= (profile.id === "fastfood" ? 12 : profile.id === "flowers" ? 6 : 10);

  if (params.inCartQty > 0) {
    return {
      label: labels.inCart,
      sublabel: `${params.inCartQty} шт.`,
      disabled: false,
      emphasis: "neutral",
      state: "in_cart",
    };
  }

  if (low) {
    return {
      label: params.addLabelOverride?.trim() ? params.addLabelOverride.trim() : labels.add,
      sublabel: `${labels.lowStockPrefix} ${params.stockLeft}`,
      disabled: false,
      emphasis: "primary",
      state: "low_stock",
    };
  }

  if (popular && profile.cta.preferBuyNow) {
    return {
      label: labels.buyNow,
      sublabel: labels.popularToday,
      disabled: false,
      emphasis: "primary",
      state: "popular",
    };
  }

  return {
    label: params.addLabelOverride?.trim() ? params.addLabelOverride.trim() : labels.add,
    disabled: false,
    emphasis: "primary",
    state: "ready",
  };
}

