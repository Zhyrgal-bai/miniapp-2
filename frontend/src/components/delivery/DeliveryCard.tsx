import { memo } from "react";
import type { DeliverySearchResultItem } from "../../types/deliveryAdmin.types";
import { ProviderBadge } from "./ProviderBadge";
import { StatusBadge } from "./StatusBadge";
import { RecoveryBadge } from "./RecoveryBadge";
import {
  formatDeliveryDate,
  formatSom,
  highlightMatch,
} from "./deliveryUtils";

type DeliveryCardProps = {
  item: DeliverySearchResultItem;
  searchQuery?: string;
  showMerchant?: boolean;
  onClick: (deliveryId: number) => void;
};

export const DeliveryCard = memo(function DeliveryCard({
  item,
  searchQuery = "",
  showMerchant = false,
  onClick,
}: DeliveryCardProps) {
  const q = searchQuery.trim();
  return (
    <article
      className="dlv-card"
      onClick={() => onClick(item.deliveryId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(item.deliveryId);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Доставка #${item.deliveryId}`}
    >
      <ProviderBadge providerId={item.provider} size="md" />
      <div className="dlv-card__main">
        <div className="dlv-card__title">
          {highlightMatch(item.customerName, q)}
          {item.orderNumber ? (
            <span className="dlv-card__meta">
              {" "}
              · {highlightMatch(`#${item.orderNumber}`, q)}
            </span>
          ) : null}
        </div>
        <div className="dlv-card__meta">
          <StatusBadge status={item.status} compact />
          <RecoveryBadge
            inRecovery={item.inRecovery}
            retryCount={item.recoveryRetryCount}
          />
          {showMerchant ? (
            <span>{highlightMatch(item.merchantName, q)}</span>
          ) : null}
          {item.providerClaimId ? (
            <span>{highlightMatch(item.providerClaimId.slice(0, 12), q)}</span>
          ) : null}
        </div>
      </div>
      <div className="dlv-card__aside">
        <div>{formatSom(item.price ?? null)}</div>
        <div>{item.etaMinutes != null ? `${item.etaMinutes} мин` : "—"}</div>
        <div>{formatDeliveryDate(item.createdAt)}</div>
      </div>
    </article>
  );
});
