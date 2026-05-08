import type React from "react";
import { Label, TextAreaField, TextField } from "./common/Fields";
import { uploadImageToCdn } from "../media/uploadImage";

type PromoBlock = {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
};

export function PromoEditor(props: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}): React.ReactElement {
  const blocks = Array.isArray(props.value.blocks)
    ? (props.value.blocks as PromoBlock[])
    : [];

  const setBlocks = (next: PromoBlock[]) => {
    const normalized = next.map((b) => {
      const out: PromoBlock = { ...b };
      if (typeof out.imageUrl === "string" && out.imageUrl.trim() === "") delete out.imageUrl;
      return out;
    });
    props.onChange({ ...props.value, blocks: normalized });
  };

  return (
    <div style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900 }}>Promo</div>
      <button
        onClick={() => setBlocks([...blocks, { title: "Акция", subtitle: "", imageUrl: undefined }])}
        style={{
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(220,38,38,0.18)",
          color: "#fff",
          padding: "10px 12px",
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        + Добавить блок
      </button>
      {blocks.map((b, idx) => (
        <div
          key={idx}
          style={{
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.03)",
            padding: 12,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 900, opacity: 0.9 }}>Блок #{idx + 1}</div>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setBlocks(blocks.filter((_, i) => i !== idx))}
              style={{
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "transparent",
                color: "rgba(255,255,255,0.85)",
                padding: "8px 10px",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Удалить
            </button>
          </div>
          <Label title="Заголовок">
            <TextField
              value={b.title ?? ""}
              onChange={(v) =>
                setBlocks(blocks.map((x, i) => (i === idx ? { ...x, title: v } : x)))
              }
            />
          </Label>
          <Label title="Подзаголовок">
            <TextAreaField
              value={b.subtitle ?? ""}
              onChange={(v) =>
                setBlocks(blocks.map((x, i) => (i === idx ? { ...x, subtitle: v } : x)))
              }
              rows={2}
            />
          </Label>
          <Label title="Изображение (URL)">
            <TextField
              value={b.imageUrl ?? ""}
              onChange={(v) =>
                setBlocks(blocks.map((x, i) => (i === idx ? { ...x, imageUrl: v } : x)))
              }
              placeholder="https://res.cloudinary.com/..."
            />
          </Label>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void uploadImageToCdn(f).then((url) =>
                  setBlocks(blocks.map((x, i) => (i === idx ? { ...x, imageUrl: url } : x))),
                );
              }}
            />
            <span style={{ opacity: 0.8, fontSize: 12 }}>Upload image</span>
          </label>
        </div>
      ))}
    </div>
  );
}

