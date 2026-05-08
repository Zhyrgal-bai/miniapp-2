import React from "react";
import { FONT_ALLOWLIST, isFontId, type FontId } from "../../themeStudio/fonts";

function readNumber(obj: unknown, key: string, fallback: number): number {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return fallback;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function readBool(obj: unknown, key: string, fallback: boolean): boolean {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return fallback;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "boolean" ? v : fallback;
}

function readFont(obj: unknown, key: string, fallback: FontId): FontId {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return fallback;
  const v = (obj as Record<string, unknown>)[key];
  return isFontId(v) ? (v as FontId) : fallback;
}

export type StorefrontTypographyConfig = {
  fontBody: FontId;
  fontTitle: FontId;
  fontButton: FontId;
  titleSize: number;
  sectionTitleSize: number;
  buttonSize: number;
  titleWeight: number;
  uppercaseTitles: boolean;
  letterSpacing: number;
  lineHeight: number;
};

export function TypographyControls(props: {
  value: unknown;
  onChange: (next: StorefrontTypographyConfig) => void;
}): React.ReactElement {
  const v: StorefrontTypographyConfig = {
    fontBody: readFont(props.value, "fontBody", "system"),
    fontTitle: readFont(props.value, "fontTitle", "system"),
    fontButton: readFont(props.value, "fontButton", "system"),
    titleSize: readNumber(props.value, "titleSize", 24),
    sectionTitleSize: readNumber(props.value, "sectionTitleSize", 16),
    buttonSize: readNumber(props.value, "buttonSize", 13),
    titleWeight: readNumber(props.value, "titleWeight", 800),
    uppercaseTitles: readBool(props.value, "uppercaseTitles", false),
    letterSpacing: readNumber(props.value, "letterSpacing", 0),
    lineHeight: readNumber(props.value, "lineHeight", 1.15),
  };

  const patch = (p: Partial<StorefrontTypographyConfig>) => props.onChange({ ...v, ...p });

  const inputStyle: React.CSSProperties = {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(2,6,23,0.45)",
    color: "#fff",
    padding: "8px 10px",
  };

  return (
    <div style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900, opacity: 0.92, fontSize: 12 }}>Typography</div>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Body font
        <select
          value={v.fontBody}
          onChange={(e) => {
            const next = e.target.value;
            if (!isFontId(next)) return;
            patch({ fontBody: next });
          }}
          style={inputStyle}
        >
          {FONT_ALLOWLIST.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Title font
        <select
          value={v.fontTitle}
          onChange={(e) => {
            const next = e.target.value;
            if (!isFontId(next)) return;
            patch({ fontTitle: next });
          }}
          style={inputStyle}
        >
          {FONT_ALLOWLIST.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Button font
        <select
          value={v.fontButton}
          onChange={(e) => {
            const next = e.target.value;
            if (!isFontId(next)) return;
            patch({ fontButton: next });
          }}
          style={inputStyle}
        >
          {FONT_ALLOWLIST.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title}
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Title size: {v.titleSize}px
          <input
            type="range"
            min={14}
            max={44}
            value={v.titleSize}
            onChange={(e) => patch({ titleSize: Number(e.target.value) })}
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Section title: {v.sectionTitleSize}px
          <input
            type="range"
            min={12}
            max={28}
            value={v.sectionTitleSize}
            onChange={(e) => patch({ sectionTitleSize: Number(e.target.value) })}
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Button size: {v.buttonSize}px
          <input
            type="range"
            min={10}
            max={20}
            value={v.buttonSize}
            onChange={(e) => patch({ buttonSize: Number(e.target.value) })}
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Title weight: {v.titleWeight}
          <input
            type="range"
            min={400}
            max={900}
            step={100}
            value={v.titleWeight}
            onChange={(e) => patch({ titleWeight: Number(e.target.value) })}
          />
        </label>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.9 }}>
        <input type="checkbox" checked={v.uppercaseTitles} onChange={(e) => patch({ uppercaseTitles: e.target.checked })} />
        Uppercase titles
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Letter spacing: {v.letterSpacing.toFixed(2)}em
        <input
          type="range"
          min={-0.06}
          max={0.5}
          step={0.01}
          value={v.letterSpacing}
          onChange={(e) => patch({ letterSpacing: Number(e.target.value) })}
        />
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
        Line height: {v.lineHeight.toFixed(2)}
        <input
          type="range"
          min={1}
          max={1.8}
          step={0.01}
          value={v.lineHeight}
          onChange={(e) => patch({ lineHeight: Number(e.target.value) })}
        />
      </label>
    </div>
  );
}

