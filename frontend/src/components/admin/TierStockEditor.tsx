import { verticalProfileFor } from "@repo-shared/businessCommerce";
import type { TierStockRow } from "./tierStockUtils";

type Props = {
  businessType: string;
  rows: TierStockRow[];
  onChange: (rows: TierStockRow[]) => void;
};

export function TierStockEditor({ businessType, rows, onChange }: Props) {
  const profile = verticalProfileFor(businessType);
  const title =
    profile.variantEditor === "bouquet_tiers"
      ? "Количество в букете и остатки"
      : profile.variantEditor === "tier_stock"
        ? `${profile.primaryAxisLabel} и остатки`
        : "Остатки";

  const setRow = (key: string, patch: Partial<TierStockRow>) => {
    onChange(
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  };

  return (
    <div className="admin-stock-block" style={{ marginTop: 16 }}>
      <p className="admin-dash-page__muted" style={{ marginBottom: 8 }}>
        {title}
      </p>
      {rows.map((row) => (
        <div key={row.key} className="admin-stock-row">
          <label style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(e) =>
                setRow(row.key, {
                  enabled: e.target.checked,
                  stock: e.target.checked ? row.stock : "",
                })
              }
            />
            <span>{row.label}</span>
          </label>
          <input
            type="number"
            min={0}
            className="admin-input"
            style={{ width: 88 }}
            disabled={!row.enabled}
            value={row.stock}
            onChange={(e) => {
              const v = e.target.value;
              setRow(row.key, {
                stock: v === "" ? "" : Math.max(0, Number(v) || 0),
              });
            }}
            placeholder="0"
          />
        </div>
      ))}
    </div>
  );
}
