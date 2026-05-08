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
      getStr("variant") === "minimal" ||
      getStr("variant") === "luxury" ||
      getStr("variant") === "fashion" ||
      getStr("variant") === "marketplace"
        ? (getStr("variant") as "minimal" | "luxury" | "fashion" | "marketplace")
        : "modern",
    imageRatio:
      getStr("imageRatio") === "portrait" || getStr("imageRatio") === "landscape"
        ? (getStr("imageRatio") as "portrait" | "landscape")
        : "square",
    rounded: getBool("rounded") !== false,
    shadow: getBool("shadow") !== false,
    compact: getBool("compact") === true,
    showBadges: getBool("showBadges") !== false,
    showWishlist: getBool("showWishlist") === true,
    buttonStyle:
      getStr("buttonStyle") === "outline" || getStr("buttonStyle") === "glass"
        ? (getStr("buttonStyle") as "outline" | "glass")
        : "solid",
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

