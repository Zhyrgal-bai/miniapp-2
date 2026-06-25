import { memo, useState } from "react";
import type { DeliverySearchResultItem } from "../../types/deliveryAdmin.types";
import type { DeliveryAnalyticsPeriod } from "../../types/deliveryAdmin.types";
import { downloadOperatorDeliveryExport } from "../../services/deliveryOperatorApi";

type ExportFormat = "csv" | "xlsx" | "json";

type ExportButtonsProps = {
  mode: "merchant" | "operator";
  operatorToken?: string;
  searchItems?: DeliverySearchResultItem[];
  deliveryId?: number | null;
  period?: DeliveryAnalyticsPeriod;
  timelineJson?: unknown;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function itemsToCsv(items: DeliverySearchResultItem[]): string {
  const headers = [
    "deliveryId",
    "orderId",
    "merchantName",
    "customerName",
    "provider",
    "status",
    "createdAt",
  ];
  const rows = items.map((i) =>
    [
      i.deliveryId,
      i.orderId,
      i.merchantName,
      i.customerName,
      i.provider,
      i.status,
      i.createdAt,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

export const ExportButtons = memo(function ExportButtons({
  mode,
  operatorToken,
  searchItems = [],
  deliveryId,
  period = "daily",
  timelineJson,
}: ExportButtonsProps) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const runMerchantExport = (format: ExportFormat) => {
    setBusy(format);
    setProgress("Подготовка файла…");
    try {
      if (format === "json") {
        const payload = timelineJson ?? { items: searchItems };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        });
        downloadBlob(blob, `deliveries-${Date.now()}.json`);
      } else {
        const csv = itemsToCsv(searchItems);
        const mime =
          format === "xlsx"
            ? "application/vnd.ms-excel"
            : "text/csv;charset=utf-8";
        const blob = new Blob(["\uFEFF", csv], { type: mime });
        const ext = format === "xlsx" ? "xlsx" : "csv";
        downloadBlob(blob, `deliveries-${Date.now()}.${ext}`);
      }
      setProgress("Готово");
    } finally {
      setTimeout(() => {
        setBusy(null);
        setProgress(null);
      }, 1200);
    }
  };

  const runOperatorExport = async (format: ExportFormat) => {
    const token = operatorToken?.trim();
    if (!token) return;
    setBusy(format);
    setProgress("Загрузка с сервера…");
    try {
      const exportType = deliveryId != null ? "timeline" : "search";
      const blob = await downloadOperatorDeliveryExport(token, {
        type: exportType,
        format,
        period,
        deliveryId: deliveryId ?? undefined,
      });
      const ext = format === "json" ? "json" : format === "xlsx" ? "xlsx" : "csv";
      downloadBlob(blob, `delivery-export-${Date.now()}.${ext}`);
      setProgress("Готово");
    } catch {
      setProgress("Ошибка экспорта");
    } finally {
      setTimeout(() => {
        setBusy(null);
        setProgress(null);
      }, 1500);
    }
  };

  const onExport = (format: ExportFormat) => {
    if (mode === "operator") void runOperatorExport(format);
    else runMerchantExport(format);
  };

  return (
    <div>
      <div className="dlv-drawer-actions">
        {(["csv", "xlsx", "json"] as const).map((fmt) => (
          <button
            key={fmt}
            type="button"
            className="dlv-btn dlv-btn--ghost dlv-btn--sm"
            disabled={busy != null}
            onClick={() => onExport(fmt)}
          >
            {fmt.toUpperCase()}
          </button>
        ))}
      </div>
      {progress ? <div className="dlv-export-progress">{progress}</div> : null}
    </div>
  );
});
