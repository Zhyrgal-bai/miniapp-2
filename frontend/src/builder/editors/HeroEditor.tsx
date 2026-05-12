import React, { useState } from "react";
import { Label, TextAreaField, TextField } from "./common/Fields";
import { uploadImageToCdn } from "../media/uploadImage";

type HeroSlide = {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  imagePublicId?: string;
  ctaText?: string;
  ctaUrl?: string;
};

export function HeroEditor(props: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}): React.ReactElement {
  const slides = Array.isArray(props.value.slides) ? (props.value.slides as HeroSlide[]) : [];
  const first = (slides[0] ?? {}) as HeroSlide;
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const setFirst = (patch: Partial<HeroSlide>) => {
    const nextSlide: HeroSlide = { ...first, ...patch };
    // normalize empty strings for optional URLs to undefined
    if (typeof nextSlide.imageUrl === "string" && nextSlide.imageUrl.trim() === "") {
      delete nextSlide.imageUrl;
      delete nextSlide.imagePublicId;
    }
    if (typeof nextSlide.ctaUrl === "string" && nextSlide.ctaUrl.trim() === "") {
      nextSlide.ctaUrl = "";
    }
    const nextSlides = slides.length > 0 ? [nextSlide, ...slides.slice(1)] : [nextSlide];
    props.onChange({ ...props.value, slides: nextSlides });
  };

  return (
    <div style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900 }}>Hero</div>
      <Label title="Заголовок">
        <TextField value={first.title ?? ""} onChange={(v) => setFirst({ title: v })} />
      </Label>
      <Label title="Подзаголовок">
        <TextAreaField
          value={first.subtitle ?? ""}
          onChange={(v) => setFirst({ subtitle: v })}
          rows={3}
        />
      </Label>
      <Label title="CTA текст">
        <TextField value={first.ctaText ?? ""} onChange={(v) => setFirst({ ctaText: v })} />
      </Label>
      <Label title="CTA URL">
        <TextField
          value={first.ctaUrl ?? ""}
          onChange={(v) => setFirst({ ctaUrl: v })}
          placeholder="https://..."
        />
      </Label>
      <Label title="Изображение (URL)">
        <TextField
          value={first.imageUrl ?? ""}
          onChange={(v) => setFirst({ imageUrl: v })}
          placeholder="https://res.cloudinary.com/..."
        />
      </Label>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setFirst({ imageUrl: undefined, imagePublicId: undefined })}
          disabled={!first.imageUrl && !first.imagePublicId}
          style={{
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "transparent",
            color: "rgba(255,255,255,0.85)",
            padding: "8px 10px",
            fontWeight: 900,
            cursor: !first.imageUrl && !first.imagePublicId ? "not-allowed" : "pointer",
            opacity: !first.imageUrl && !first.imagePublicId ? 0.5 : 1,
          }}
        >
          Remove
        </button>
        {uploadPct != null ? (
          <div style={{ fontSize: 12, opacity: 0.85 }}>Uploading… {uploadPct}%</div>
        ) : null}
        {uploadErr ? <div style={{ fontSize: 12, color: "#fca5a5" }}>{uploadErr}</div> : null}
      </div>
      <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setUploadErr(null);
            setUploadPct(0);
            void uploadImageToCdn(f, { onProgress: setUploadPct })
              .then((asset) => setFirst({ imageUrl: asset.url, imagePublicId: asset.publicId }))
              .catch((err) => setUploadErr(err instanceof Error ? err.message : "Upload failed"))
              .finally(() => setUploadPct(null));
          }}
        />
        <span style={{ opacity: 0.8, fontSize: 12 }}>Upload image</span>
      </label>
      <div style={{ opacity: 0.7, fontSize: 12 }}>
        Поддерживаются только https URL из allowlist (например Cloudinary).
      </div>
    </div>
  );
}

