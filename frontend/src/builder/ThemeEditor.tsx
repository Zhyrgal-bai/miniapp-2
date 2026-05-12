import React from "react";
import type { ResolvedStoreTheme } from "@repo-shared/storeTheme";
import { THEME_PRESETS } from "./themePresets";
import { FONT_ALLOWLIST, isFontId, type FontId } from "../themeStudio/fonts";

export function ThemeEditor(props: {
  theme: ResolvedStoreTheme;
  onPatch: (patch: Record<string, unknown>) => void;
}): React.ReactElement {
  const t = props.theme;
  const t3 = (t as unknown as { tokensV3?: unknown }).tokensV3;
  const t3obj: Record<string, unknown> | null =
    t3 && typeof t3 === "object" && !Array.isArray(t3) ? (t3 as Record<string, unknown>) : null;
  const palette =
    t3obj?.palette && typeof t3obj.palette === "object" && !Array.isArray(t3obj.palette)
      ? (t3obj.palette as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const getPal = (k: string, fb: string) => (typeof palette[k] === "string" ? (palette[k] as string) : fb);
  const patchPal = (k: string, v: string) =>
    props.onPatch({
      tokensV3: {
        ...(t3obj ?? {}),
        version: 3,
        palette: {
          ...(t3obj?.palette ?? {}),
          [k]: v,
        },
      },
    });
  const density: string =
    t3obj && typeof t3obj.density === "string" ? t3obj.density : "normal";
  const typography =
    t3obj?.typography && typeof t3obj.typography === "object" && !Array.isArray(t3obj.typography)
      ? (t3obj.typography as Record<string, unknown>)
      : null;
  const fonts =
    typography?.fonts && typeof typography.fonts === "object" && !Array.isArray(typography.fonts)
      ? (typography.fonts as Record<string, unknown>)
      : null;
  const headingFont: FontId =
    isFontId(fonts?.heading)
      ? (fonts?.heading as FontId)
      : "system";
  const bodyFont: FontId =
    isFontId(fonts?.body)
      ? (fonts?.body as FontId)
      : "system";
  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Theme</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {THEME_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() =>
              props.onPatch({
                templateId: p.id,
                ...(p.colors ?? {}),
                tokens: p.tokens,
              })
            }
            style={{
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.03)",
              color: "#fff",
              padding: "8px 12px",
              fontWeight: 900,
              fontSize: 12,
              cursor: "pointer",
            }}
            title="Apply preset"
          >
            {p.title}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
        <div style={{ fontWeight: 900, opacity: 0.9, fontSize: 12 }}>Fonts & Density (V3)</div>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Heading font
          <select
            value={headingFont}
            onChange={(e) => {
              const next = e.target.value;
              if (!isFontId(next)) return;
              props.onPatch({
                tokensV3: {
                  ...(t3obj ?? {}),
                  version: 3,
                  typography: {
                    ...(t3obj?.typography ?? {}),
                    fonts: {
                      ...(typography?.fonts ?? {}),
                      heading: next,
                    },
                  },
                },
              });
            }}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(2,6,23,0.45)",
              color: "#fff",
              padding: "8px 10px",
            }}
          >
            {FONT_ALLOWLIST.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Body font
          <select
            value={bodyFont}
            onChange={(e) => {
              const next = e.target.value;
              if (!isFontId(next)) return;
              props.onPatch({
                tokensV3: {
                  ...(t3obj ?? {}),
                  version: 3,
                  typography: {
                    ...(t3obj?.typography ?? {}),
                    fonts: {
                      ...(typography?.fonts ?? {}),
                      body: next,
                    },
                  },
                },
              });
            }}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(2,6,23,0.45)",
              color: "#fff",
              padding: "8px 10px",
            }}
          >
            {FONT_ALLOWLIST.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Density
          <select
            value={density}
            onChange={(e) => {
              const next = e.target.value;
              if (next !== "compact" && next !== "normal" && next !== "comfortable") return;
              props.onPatch({
                tokensV3: {
                  ...(t3obj ?? {}),
                  version: 3,
                  density: next,
                },
              });
            }}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(2,6,23,0.45)",
              color: "#fff",
              padding: "8px 10px",
            }}
          >
            <option value="compact">Compact</option>
            <option value="normal">Normal</option>
            <option value="comfortable">Comfortable</option>
          </select>
        </label>
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          Safe allowlist (без custom CSS). Мгновенный preview через CSS variables.
        </div>
      </div>
      <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
        <div style={{ fontWeight: 900, opacity: 0.9, fontSize: 12 }}>Palette (V3)</div>
        {[
          ["primary", "Primary", t.primaryColor],
          ["secondary", "Secondary", "#22c55e"],
          ["accent", "Accent", "#f97316"],
          ["background", "Background", t.bgColor],
          ["surface", "Surface", t.bgColor],
          ["card", "Card", t.cardColor],
          ["text", "Text", t.textColor],
          ["muted", "Muted", "#94a3b8"],
          ["border", "Border", "#334155"],
          ["success", "Success", "#22c55e"],
          ["warning", "Warning", "#f59e0b"],
          ["danger", "Danger", "#ef4444"],
        ].map(([key, label, fb]) => (
          <label
            key={String(key)}
            style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}
          >
            {label}
            <input
              defaultValue={getPal(String(key), String(fb))}
              onBlur={(e) => patchPal(String(key), e.target.value)}
              style={{
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(2,6,23,0.45)",
                color: "#fff",
                padding: "8px 10px",
              }}
            />
          </label>
        ))}
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          Цвета применяются через <b>--sf-color-*</b> (без inline инъекций).
        </div>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Primary
          <input
            defaultValue={t.primaryColor}
            onBlur={(e) => props.onPatch({ primaryColor: e.target.value })}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(2,6,23,0.45)",
              color: "#fff",
              padding: "8px 10px",
            }}
          />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Background
          <input
            defaultValue={t.bgColor}
            onBlur={(e) => props.onPatch({ bgColor: e.target.value })}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(2,6,23,0.45)",
              color: "#fff",
              padding: "8px 10px",
            }}
          />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Text
          <input
            defaultValue={t.textColor}
            onBlur={(e) => props.onPatch({ textColor: e.target.value })}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(2,6,23,0.45)",
              color: "#fff",
              padding: "8px 10px",
            }}
          />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          Card
          <input
            defaultValue={t.cardColor}
            onBlur={(e) => props.onPatch({ cardColor: e.target.value })}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(2,6,23,0.45)",
              color: "#fff",
              padding: "8px 10px",
            }}
          />
        </label>
      </div>
    </div>
  );
}

