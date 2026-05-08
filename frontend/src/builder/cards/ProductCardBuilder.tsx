import React, { useMemo } from "react";
import { ProductCardControls, type StorefrontCardConfig } from "./ProductCardControls";
import { ProductCardPreview } from "./ProductCardPreview";

function normalize(input: unknown): StorefrontCardConfig {
  const c = (input && typeof input === "object" && !Array.isArray(input) ? input : {}) as any;
  return {
    variant:
      c.variant === "minimal" ||
      c.variant === "luxury" ||
      c.variant === "fashion" ||
      c.variant === "marketplace"
        ? c.variant
        : "modern",
    imageRatio: c.imageRatio === "portrait" || c.imageRatio === "landscape" ? c.imageRatio : "square",
    rounded: c.rounded !== false,
    shadow: c.shadow !== false,
    compact: c.compact === true,
    showBadges: c.showBadges !== false,
    showWishlist: c.showWishlist === true,
    buttonStyle: c.buttonStyle === "outline" || c.buttonStyle === "glass" ? c.buttonStyle : "solid",
    textAlign: c.textAlign === "center" ? "center" : "left",
    hoverEffect:
      c.hoverEffect === "none" || c.hoverEffect === "scale" || c.hoverEffect === "lift"
        ? c.hoverEffect
        : "lift",
  };
}

export function ProductCardBuilder(props: {
  value: unknown;
  onChange: (next: StorefrontCardConfig) => void;
}): React.ReactElement {
  const v = useMemo(() => normalize(props.value), [props.value]);
  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
      <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <ProductCardPreview value={v} />
      </div>
      <div style={{ minHeight: 0, overflow: "auto" }}>
        <ProductCardControls value={v} onChange={props.onChange} />
      </div>
    </div>
  );
}

