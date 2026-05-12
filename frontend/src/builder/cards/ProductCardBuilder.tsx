import React, { useMemo } from "react";
import { ProductCardControls, type StorefrontCardConfig } from "./ProductCardControls";
import { ProductCardPreview } from "./ProductCardPreview";

function normalize(input: unknown): StorefrontCardConfig {
  const c: Record<string, unknown> =
    input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const getStr = (k: string): string | null => (typeof c[k] === "string" ? (c[k] as string) : null);
  const getBool = (k: string): boolean | null => (typeof c[k] === "boolean" ? (c[k] as boolean) : null);
  return {
    variant:
      getStr("variant") === "compact" ||
      getStr("variant") === "minimal" ||
      getStr("variant") === "luxury" ||
      getStr("variant") === "fashion" ||
      getStr("variant") === "marketplace" ||
      getStr("variant") === "neon"
        ? (getStr("variant") as "compact" | "minimal" | "luxury" | "fashion" | "marketplace" | "neon")
        : "modern",
    imageRatio:
      getStr("imageRatio") === "portrait" || getStr("imageRatio") === "landscape"
        ? (getStr("imageRatio") as "portrait" | "landscape")
        : "square",
    imageFit: getStr("imageFit") === "contain" ? "contain" : "cover",
    imageShadow: getBool("imageShadow") === true,
    rounded: getBool("rounded") !== false,
    shadow: getBool("shadow") !== false,
    compact: getBool("compact") === true,
    density: getStr("density") === "compact" || getStr("density") === "airy" ? (getStr("density") as "compact" | "airy") : "normal",
    priceStyle: getStr("priceStyle") === "luxury" || getStr("priceStyle") === "compact" ? (getStr("priceStyle") as "luxury" | "compact") : "bold",
    showBadges: getBool("showBadges") !== false,
    badgeStyle: getStr("badgeStyle") === "glow" || getStr("badgeStyle") === "luxury" ? (getStr("badgeStyle") as "glow" | "luxury") : "minimal",
    badgePosition: getStr("badgePosition") === "topRight" || getStr("badgePosition") === "bottomLeft" ? (getStr("badgePosition") as "topRight" | "bottomLeft") : "topLeft",
    showWishlist: getBool("showWishlist") === true,
    ctaStyle:
      getStr("ctaStyle") === "square" ||
      getStr("ctaStyle") === "glow" ||
      getStr("ctaStyle") === "outline" ||
      getStr("ctaStyle") === "full"
        ? (getStr("ctaStyle") as "square" | "glow" | "outline" | "full")
        : "pill",
    textAlign: getStr("textAlign") === "center" ? "center" : "left",
    hoverEffect:
      getStr("hoverEffect") === "none" || getStr("hoverEffect") === "scale" || getStr("hoverEffect") === "lift"
        ? (getStr("hoverEffect") as "none" | "scale" | "lift")
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

