import type React from "react";

export function Label(props: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.92 }}>
      <div style={{ fontWeight: 800, opacity: 0.9 }}>{props.title}</div>
      {props.children}
    </label>
  );
}

export function TextField(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}): React.ReactElement {
  return (
    <input
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      style={{
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(2,6,23,0.45)",
        color: "#fff",
        padding: "8px 10px",
        outline: "none",
      }}
    />
  );
}

export function TextAreaField(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}): React.ReactElement {
  return (
    <textarea
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      rows={props.rows ?? 4}
      style={{
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(2,6,23,0.45)",
        color: "#fff",
        padding: "8px 10px",
        outline: "none",
        resize: "vertical",
      }}
    />
  );
}

export function Toggle(props: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}): React.ReactElement {
  return (
    <button
      onClick={() => props.onChange(!props.checked)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.03)",
        color: "#fff",
        padding: "10px 12px",
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      <span style={{ opacity: 0.9 }}>{props.label}</span>
      <span style={{ opacity: props.checked ? 1 : 0.6 }}>
        {props.checked ? "On" : "Off"}
      </span>
    </button>
  );
}

export function NumberField(props: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}): React.ReactElement {
  return (
    <input
      type="number"
      value={String(props.value)}
      min={props.min}
      max={props.max}
      onChange={(e) => props.onChange(Number(e.target.value))}
      style={{
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(2,6,23,0.45)",
        color: "#fff",
        padding: "8px 10px",
        outline: "none",
      }}
    />
  );
}

