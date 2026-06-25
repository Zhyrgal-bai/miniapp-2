import { sanitizeExportRow } from "../dto/deliveryOperationsDto.js";
import { incrementDeliveryMetric } from "../../utils/deliveryMetrics.js";
import { logDeliveryExported } from "../utils/deliveryOperationsLogging.js";

export type ExportFormat = "csv" | "excel" | "json";

export type ExportPayload = {
  filename: string;
  contentType: string;
  body: string;
};

function escapeCsv(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0] ?? {});
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(",")),
  ];
  return lines.join("\n");
}

function toExcelXml(rows: Record<string, unknown>[]): string {
  const headers = rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];
  const headerRow = headers.map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join("");
  const dataRows = rows
    .map((row) => {
      const cells = headers
        .map(
          (h) =>
            `<Cell><Data ss:Type="String">${escapeXml(String(row[h] ?? ""))}</Data></Cell>`,
        )
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Export">
  <Table>
   <Row>${headerRow}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createDeliveryExportService() {
  function exportRows(
    exportType: string,
    format: ExportFormat,
    rows: Record<string, unknown>[],
    actor: string,
  ): ExportPayload {
    const safe = rows.map(sanitizeExportRow);
    incrementDeliveryMetric("delivery_export_total");
    logDeliveryExported({
      exportType,
      format,
      rowCount: safe.length,
      actor,
    });

    const stamp = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      return {
        filename: `delivery-${exportType}-${stamp}.json`,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ exportType, exportedAt: new Date().toISOString(), rows: safe }, null, 2),
      };
    }

    if (format === "excel") {
      return {
        filename: `delivery-${exportType}-${stamp}.xls`,
        contentType: "application/vnd.ms-excel; charset=utf-8",
        body: toExcelXml(safe),
      };
    }

    return {
      filename: `delivery-${exportType}-${stamp}.csv`,
      contentType: "text/csv; charset=utf-8",
      body: `\uFEFF${toCsv(safe)}`,
    };
  }

  return { exportRows };
}

export function parseExportFormat(raw: unknown): ExportFormat {
  if (raw === "excel" || raw === "json" || raw === "csv") return raw;
  return "csv";
}
