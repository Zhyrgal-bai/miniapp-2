import type React from "react";
import { Label, NumberField, TextField } from "./common/Fields";

export function FeaturedProductsEditor(props: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}): React.ReactElement {
  const title = typeof props.value.title === "string" ? props.value.title : "Хиты";
  const limitRaw = typeof props.value.limit === "number" ? props.value.limit : 8;
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(24, Math.trunc(limitRaw))) : 8;

  return (
    <div style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900 }}>Featured Products</div>
      <Label title="Заголовок">
        <TextField
          value={title}
          onChange={(v) => props.onChange({ ...props.value, title: v })}
        />
      </Label>
      <Label title="Лимит (1–24)">
        <NumberField
          value={limit}
          min={1}
          max={24}
          onChange={(v) => props.onChange({ ...props.value, limit: v })}
        />
      </Label>
    </div>
  );
}

