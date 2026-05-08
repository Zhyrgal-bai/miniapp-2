import type React from "react";
import { StorefrontRenderer } from "../components/storefront/StorefrontRenderer";
import type { ResolvedStorefrontPayload } from "../components/storefront/StorefrontRenderer";
import type { PreviewMode } from "./preview/modes";
import { modeWidth } from "./preview/modes";

export function BuilderCanvas(props: {
  previewPayload: ResolvedStorefrontPayload;
  mode: PreviewMode;
}): React.ReactElement {
  const w = modeWidth(props.mode);
  return (
    <div
      style={{
        minHeight: "100%",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(2,6,23,0.25)",
        overflow: "auto",
      }}
    >
      <div
        style={{
          minHeight: "100%",
          display: "flex",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: w,
            transition: "max-width 220ms ease",
          }}
        >
          {Array.isArray(props.previewPayload.sections) &&
          props.previewPayload.sections.length === 0 ? (
            <div
              style={{
                padding: 16,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                color: "rgba(255,255,255,0.85)",
                textAlign: "center",
              }}
            >
              Добавьте первую секцию, чтобы увидеть превью.
            </div>
          ) : (
            <StorefrontRenderer payload={props.previewPayload} />
          )}
        </div>
      </div>
    </div>
  );
}

