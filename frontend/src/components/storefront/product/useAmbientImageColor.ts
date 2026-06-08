import { useEffect, useState } from "react";

/** Muted RGB from product photo — YouTube Ambient-style, no neon. */
export function useAmbientImageColor(src: string | undefined | null): string | null {
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    const url = typeof src === "string" ? src.trim() : "";
    if (url === "") {
      setColor(null);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 24;
        canvas.height = 24;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 24, 24);
        const data = ctx.getImageData(0, 0, 24, 24).data;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3]! < 100) continue;
          r += data[i]!;
          g += data[i + 1]!;
          b += data[i + 2]!;
          n += 1;
        }
        if (n === 0) return;
        r = Math.round(r / n);
        g = Math.round(g / n);
        b = Math.round(b / n);
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const desat = 0.62;
        r = Math.round(r * (1 - desat) + lum * desat);
        g = Math.round(g * (1 - desat) + lum * desat);
        b = Math.round(b * (1 - desat) + lum * desat);
        const dim = 0.68;
        r = Math.round(r * dim);
        g = Math.round(g * dim);
        b = Math.round(b * dim);
        if (!cancelled) setColor(`rgb(${r}, ${g}, ${b})`);
      } catch {
        if (!cancelled) setColor(null);
      }
    };

    img.onerror = () => {
      if (!cancelled) setColor(null);
    };
    img.src = url;

    return () => {
      cancelled = true;
    };
  }, [src]);

  return color;
}
