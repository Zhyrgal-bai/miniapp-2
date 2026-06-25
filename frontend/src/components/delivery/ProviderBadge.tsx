import { memo } from "react";
import { getProviderMeta } from "./deliveryUtils";

type ProviderBadgeProps = {
  providerId: string;
  showLabel?: boolean;
  size?: "sm" | "md";
};

export const ProviderBadge = memo(function ProviderBadge({
  providerId,
  showLabel = true,
  size = "md",
}: ProviderBadgeProps) {
  const meta = getProviderMeta(providerId);
  const logoSize = size === "sm" ? 24 : 28;
  return (
    <span className="dlv-provider" title={meta.label}>
      <span
        className="dlv-provider__logo"
        style={{ background: meta.accent, width: logoSize, height: logoSize }}
        aria-hidden
      >
        {meta.glyph}
      </span>
      {showLabel ? <span>{meta.shortLabel}</span> : null}
    </span>
  );
});
