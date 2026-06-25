import { memo } from "react";
import type { ProviderDeliveryStatus } from "../../types/deliveryAdmin.types";
import {
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_TONE,
} from "./deliveryUtils";

type StatusBadgeProps = {
  status: ProviderDeliveryStatus | string;
  compact?: boolean;
};

export const StatusBadge = memo(function StatusBadge({
  status,
  compact = false,
}: StatusBadgeProps) {
  const key = status as ProviderDeliveryStatus;
  const label = DELIVERY_STATUS_LABELS[key] ?? status;
  const tone = DELIVERY_STATUS_TONE[key] ?? "neutral";
  return (
    <span
      className={`dlv-badge dlv-badge--${tone}${compact ? " dlv-badge--compact" : ""}`}
    >
      {label}
    </span>
  );
});
