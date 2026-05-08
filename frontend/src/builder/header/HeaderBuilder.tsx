import React, { useMemo } from "react";
import type { ResolvedStoreTheme } from "@repo-shared/storeTheme";
import { HeaderControls, type StorefrontHeaderConfig } from "./HeaderControls";
import { HeaderPreview } from "./HeaderPreview";

function normalize(input: unknown): StorefrontHeaderConfig {
  const c: Record<string, unknown> =
    input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const getStr = (k: string): string | null => (typeof c[k] === "string" ? (c[k] as string) : null);
  const getBool = (k: string): boolean | null => (typeof c[k] === "boolean" ? (c[k] as boolean) : null);
  const getNum = (k: string): number | null =>
    typeof c[k] === "number" && Number.isFinite(c[k]) ? (c[k] as number) : null;
  return {
    variant:
      getStr("variant") === "centered" ||
      getStr("variant") === "split" ||
      getStr("variant") === "minimal" ||
      getStr("variant") === "luxury" ||
      getStr("variant") === "commerce"
        ? (getStr("variant") as "centered" | "split" | "minimal" | "luxury" | "commerce")
        : "commerce",
    titleText: typeof c.titleText === "string" ? (c.titleText as string).slice(0, 32) : undefined,
    showAvatar: getBool("showAvatar") !== false,
    showSearch: getBool("showSearch") === true,
    sticky: getBool("sticky") !== false,
    glass: getBool("glass") === true,
    alignment: getStr("alignment") === "left" ? "left" : "center",
    height: getStr("height") === "compact" || getStr("height") === "large" ? (getStr("height") as "compact" | "large") : "normal",
    logoSize:
      getNum("logoSize") != null
        ? Math.min(64, Math.max(18, Math.round(getNum("logoSize") as number)))
        : 34,
    titleStyle: getStr("titleStyle") === "uppercase" || getStr("titleStyle") === "wide" ? (getStr("titleStyle") as "uppercase" | "wide") : "normal",
    shadow: getBool("shadow") !== false,
    border: getBool("border") === true,
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

