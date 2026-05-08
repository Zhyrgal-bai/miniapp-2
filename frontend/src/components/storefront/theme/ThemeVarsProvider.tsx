import React, { useMemo } from "react";
import type { ResolvedStoreTheme } from "@repo-shared/storeTheme";
import { applyThemeVars } from "./applyThemeVars";

export function ThemeVarsProvider(props: {
  theme: ResolvedStoreTheme;
  children: React.ReactNode;
}): React.ReactElement {
  const style = useMemo(() => applyThemeVars(props.theme), [props.theme]);
  return (
    <div
      style={{
        ...style,
        background: "var(--sf-color-background)",
        color: "var(--sf-color-text)",
        fontFamily: "var(--sf-font-body)",
        minHeight: "100%",
      }}
    >
      {props.children}
    </div>
  );
}

