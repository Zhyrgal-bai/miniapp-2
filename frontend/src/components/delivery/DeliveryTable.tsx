import { memo } from "react";
import type { DeliverySearchResultItem } from "../../types/deliveryAdmin.types";
import { ProviderBadge } from "./ProviderBadge";
import { StatusBadge } from "./StatusBadge";
import { RecoveryBadge } from "./RecoveryBadge";
import { formatDeliveryDate, formatSom, highlightMatch } from "./deliveryUtils";

type DeliveryTableProps = {
  items: DeliverySearchResultItem[];
  searchQuery?: string;
  showMerchant?: boolean;
  onRowClick: (deliveryId: number) => void;
};

export const DeliveryTable = memo(function DeliveryTable({
  items,
  searchQuery = "",
  showMerchant = false,
  onRowClick,
}: DeliveryTableProps) {
  const q = searchQuery.trim();
  return (
    <div className="dlv-table-wrap">
      <table className="dlv-table">
        <thead>
          <tr>
            <th>Провайдер</th>
            <th>Статус</th>
            {showMerchant ? <th>Магазин</th> : null}
            <th>Клиент</th>
            <th>Цена</th>
            <th>ETA</th>
            <th>Создано</th>
            <th>Обновлено</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.deliveryId}
              onClick={() => onRowClick(item.deliveryId)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") onRowClick(item.deliveryId);
              }}
            >
              <td>
                <ProviderBadge providerId={item.provider} size="sm" />
              </td>
              <td>
                <StatusBadge status={item.status} compact />
                <RecoveryBadge
                  inRecovery={item.inRecovery}
                  retryCount={item.recoveryRetryCount}
                />
              </td>
              {showMerchant ? (
                <td>{highlightMatch(item.merchantName, q)}</td>
              ) : null}
              <td>
                {highlightMatch(item.customerName, q)}
                <div className="dlv-card__meta">{item.phoneMasked}</div>
              </td>
              <td>{formatSom(item.price ?? null)}</td>
              <td>{item.etaMinutes != null ? `${item.etaMinutes} мин` : "—"}</td>
              <td>{formatDeliveryDate(item.createdAt)}</td>
              <td>{formatDeliveryDate(item.providerUpdatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
