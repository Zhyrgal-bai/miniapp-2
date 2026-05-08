import type React from "react";
import { StorefrontRenderer } from "../components/storefront/StorefrontRenderer";
import type { ResolvedStorefrontPayload } from "../components/storefront/StorefrontRenderer";

export function BuilderCanvas(props: {
  previewPayload: ResolvedStorefrontPayload;
}): React.ReactElement {
  return (
    <div
      style={{
        minHeight: "100%",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <StorefrontRenderer payload={props.previewPayload} />
    </div>
  );
}

