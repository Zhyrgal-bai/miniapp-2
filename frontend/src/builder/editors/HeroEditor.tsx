import type React from "react";
import { Label, TextAreaField, TextField } from "./common/Fields";
import { uploadImageToCdn } from "../media/uploadImage";

type HeroSlide = {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
};

export function HeroEditor(props: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}): React.ReactElement {
  const slides = Array.isArray(props.value.slides) ? (props.value.slides as HeroSlide[]) : [];
  const first = (slides[0] ?? {}) as HeroSlide;

  const setFirst = (patch: Partial<HeroSlide>) => {
    const nextSlide: HeroSlide = { ...first, ...patch };
    // normalize empty strings for optional URLs to undefined
    if (typeof nextSlide.imageUrl === "string" && nextSlide.imageUrl.trim() === "") {
      delete nextSlide.imageUrl;
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
      <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            void uploadImageToCdn(f).then((url) => setFirst({ imageUrl: url }));
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

