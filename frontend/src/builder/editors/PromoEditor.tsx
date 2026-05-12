import React, { useState } from "react";
import { Label, TextAreaField, TextField } from "./common/Fields";
import { uploadImageToCdn } from "../media/uploadImage";

type PromoBlock = {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  imagePublicId?: string;
};

export function PromoEditor(props: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}): React.ReactElement {
  const blocks = Array.isArray(props.value.blocks)
    ? (props.value.blocks as PromoBlock[])
    : [];
  const [uploadPct, setUploadPct] = useState<Record<number, number | null>>({});
  const [uploadErr, setUploadErr] = useState<Record<number, string | null>>({});

  const setBlocks = (next: PromoBlock[]) => {
    const normalized = next.map((b) => {
      const out: PromoBlock = { ...b };
      if (typeof out.imageUrl === "string" && out.imageUrl.trim() === "") {
        delete out.imageUrl;
        delete out.imagePublicId;
      }
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
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              onClick={() =>
                setBlocks(
                  blocks.map((x, i) =>
                    i === idx ? { ...x, imageUrl: undefined, imagePublicId: undefined } : x,
                  ),
                )
              }
              disabled={!b.imageUrl && !b.imagePublicId}
              style={{
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "transparent",
                color: "rgba(255,255,255,0.85)",
                padding: "8px 10px",
                fontWeight: 900,
                cursor: !b.imageUrl && !b.imagePublicId ? "not-allowed" : "pointer",
                opacity: !b.imageUrl && !b.imagePublicId ? 0.5 : 1,
              }}
            >
              Remove
            </button>
            {uploadPct[idx] != null ? (
              <div style={{ fontSize: 12, opacity: 0.85 }}>Uploading… {uploadPct[idx]}%</div>
            ) : null}
            {uploadErr[idx] ? (
              <div style={{ fontSize: 12, color: "#fca5a5" }}>{uploadErr[idx]}</div>
            ) : null}
          </div>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUploadErr((s) => ({ ...s, [idx]: null }));
                setUploadPct((s) => ({ ...s, [idx]: 0 }));
                void uploadImageToCdn(f, {
                  onProgress: (pct) => setUploadPct((s) => ({ ...s, [idx]: pct })),
                })
                  .then((asset) =>
                    setBlocks(
                      blocks.map((x, i) =>
                        i === idx ? { ...x, imageUrl: asset.url, imagePublicId: asset.publicId } : x,
                      ),
                    ),
                  )
                  .catch((err) =>
                    setUploadErr((s) => ({
                      ...s,
                      [idx]: err instanceof Error ? err.message : "Upload failed",
                    })),
                  )
                  .finally(() => setUploadPct((s) => ({ ...s, [idx]: null })));
              }}
            />
            <span style={{ opacity: 0.8, fontSize: 12 }}>Upload image</span>
          </label>
        </div>
      ))}
    </div>
  );
}

