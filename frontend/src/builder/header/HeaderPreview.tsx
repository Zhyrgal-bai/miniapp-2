import React from "react";
import type { ResolvedStoreTheme } from "@repo-shared/storeTheme";
import { StorefrontHeader } from "../../components/storefront/header/StorefrontHeader";
import type { StorefrontHeaderConfig } from "./HeaderControls";

export function HeaderPreview(props: {
  theme: ResolvedStoreTheme;
  value: StorefrontHeaderConfig;
}): React.ReactElement {
  return (
    <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.10)" }}>
      <StorefrontHeader theme={props.theme} config={props.value as unknown as Record<string, unknown>} />
    </div>
  );
}

