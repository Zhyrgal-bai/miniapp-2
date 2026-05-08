import React, { useMemo } from "react";
import type { ResolvedStoreTheme } from "@repo-shared/storeTheme";
import { HeaderControls, type StorefrontHeaderConfig } from "./HeaderControls";
import { HeaderPreview } from "./HeaderPreview";

function normalize(input: unknown): StorefrontHeaderConfig {
  const c = (input && typeof input === "object" && !Array.isArray(input) ? input : {}) as any;
  return {
    variant:
      c.variant === "centered" ||
      c.variant === "split" ||
      c.variant === "minimal" ||
      c.variant === "luxury" ||
      c.variant === "commerce"
        ? c.variant
        : "commerce",
    showAvatar: c.showAvatar !== false,
    showSearch: c.showSearch === true,
    sticky: c.sticky !== false,
    glass: c.glass === true,
    alignment: c.alignment === "left" ? "left" : "center",
    height: c.height === "compact" || c.height === "large" ? c.height : "normal",
    logoSize:
      typeof c.logoSize === "number" && Number.isFinite(c.logoSize)
        ? Math.min(64, Math.max(18, Math.round(c.logoSize)))
        : 34,
    titleStyle: c.titleStyle === "uppercase" || c.titleStyle === "wide" ? c.titleStyle : "normal",
    shadow: c.shadow !== false,
    border: c.border === true,
  };
}

export function HeaderBuilder(props: {
  theme: ResolvedStoreTheme;
  value: unknown;
  onChange: (next: StorefrontHeaderConfig) => void;
}): React.ReactElement {
  const v = useMemo(() => normalize(props.value), [props.value]);
  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
      <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <HeaderPreview theme={props.theme} value={v} />
      </div>
      <div style={{ minHeight: 0, overflow: "auto" }}>
        <HeaderControls value={v} onChange={props.onChange} />
      </div>
    </div>
  );
}

