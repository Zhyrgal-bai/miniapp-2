import type React from "react";
import { Label, TextAreaField, TextField } from "./common/Fields";

export function FooterEditor(props: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}): React.ReactElement {
  const text = typeof props.value.text === "string" ? props.value.text : "";
  const phone = typeof props.value.phone === "string" ? props.value.phone : "";
  const instagramUrl =
    typeof props.value.instagramUrl === "string" ? props.value.instagramUrl : "";

  return (
    <div style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900 }}>Footer</div>
      <Label title="Текст">
        <TextAreaField
          value={text}
          onChange={(v) => props.onChange({ ...props.value, text: v })}
          rows={4}
        />
      </Label>
      <Label title="Телефон">
        <TextField
          value={phone}
          onChange={(v) => props.onChange({ ...props.value, phone: v })}
          placeholder="+996..."
        />
      </Label>
      <Label title="Instagram URL">
        <TextField
          value={instagramUrl}
          onChange={(v) => props.onChange({ ...props.value, instagramUrl: v })}
          placeholder="https://instagram.com/..."
        />
      </Label>
    </div>
  );
}

