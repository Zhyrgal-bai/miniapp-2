import type React from "react";
import { Label, TextField, Toggle } from "./common/Fields";

export function CategoriesEditor(props: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}): React.ReactElement {
  const title = typeof props.value.title === "string" ? props.value.title : "Категории";
  const showCounts = typeof props.value.showCounts === "boolean" ? props.value.showCounts : true;

  return (
    <div style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900 }}>Categories</div>
      <Label title="Заголовок">
        <TextField
          value={title}
          onChange={(v) => props.onChange({ ...props.value, title: v })}
        />
      </Label>
      <Toggle
        checked={showCounts}
        onChange={(v) => props.onChange({ ...props.value, showCounts: v })}
        label="Показывать счётчик"
      />
    </div>
  );
}

