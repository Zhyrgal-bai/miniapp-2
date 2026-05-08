import type { RawStorefrontConfig } from "../storefront/schema.js";
import type { ResolvedStoreTheme } from "../shared/storeTheme.js";
import { uxPush, uxReportEmpty, type UxReport } from "./rules.js";
import { normalizeHexColor } from "../shared/storeTheme.js";

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeHexColor(hex);
  if (!n) return null;
  const v = n.slice(1);
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) ? { r, g, b } : null;
}

function srgbToLin(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function luminance(rgb: { r: number; g: number; b: number }): number {
  const r = srgbToLin(rgb.r);
  const g = srgbToLin(rgb.g);
  const b = srgbToLin(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number | null {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return null;
  const la = luminance(ra);
  const lb = luminance(rb);
  const [L1, L2] = la >= lb ? [la, lb] : [lb, la];
  return (L1 + 0.05) / (L2 + 0.05);
}

export function validateUx(params: {
  draft: RawStorefrontConfig;
  theme: ResolvedStoreTheme;
}): UxReport {
  const r = uxReportEmpty();

  // Contrast: basic AA-ish guard for main text vs background
  const cr = contrastRatio(params.theme.textColor, params.theme.bgColor);
  if (cr != null && cr < 3.5) {
    uxPush(r, {
      code: "contrast.low",
      level: "warning",
      message: "Низкий контраст текста и фона. Рекомендуется увеличить контраст для читаемости.",
      path: "theme.textColor/theme.bgColor",
    });
  }

  // CTA text length guard in hero slides
  for (const sec of params.draft.sections ?? []) {
    if ((sec as any).type !== "hero") continue;
    const slides = (sec as any).config?.slides;
    if (!Array.isArray(slides)) continue;
    slides.forEach((s: any, idx: number) => {
      const ctaText = typeof s?.ctaText === "string" ? s.ctaText.trim() : "";
      if (ctaText && ctaText.length > 24) {
        uxPush(r, {
          code: "hero.cta.too_long",
          level: "warning",
          message: "Слишком длинный CTA в Hero. Лучше до 24 символов.",
          path: `sections[${idx}].config.slides[].ctaText`,
        });
      }
    });
  }

  // Button size (tokens v2)
  const py = params.theme.tokens?.button?.paddingY;
  if (typeof py === "number" && py > 0 && py < 10) {
    uxPush(r, {
      code: "button.too_small",
      level: "warning",
      message: "Слишком маленькие кнопки (paddingY). Рекомендуется увеличить для удобства на мобильных.",
      path: "theme.tokens.button.paddingY",
    });
  }

  // Typography guards (tokens v3, if present)
  const t3 = (params.theme as any).tokensV3 as any | undefined;
  try {
    const base = t3?.typography?.sizes?.base;
    if (typeof base === "number" && base > 0 && base < 14) {
      uxPush(r, {
        code: "typography.too_small",
        level: "warning",
        message:
          "Слишком маленький базовый шрифт. Для Telegram Mini App лучше >= 14px.",
        path: "theme.tokensV3.typography.sizes.base",
      });
    }
    const lh = t3?.typography?.lineHeights?.body;
    if (typeof lh === "number" && lh > 0 && lh < 1.25) {
      uxPush(r, {
        code: "typography.line_height_low",
        level: "warning",
        message:
          "Слишком маленький line-height для текста. Рекомендуется >= 1.3 для читабельности.",
        path: "theme.tokensV3.typography.lineHeights.body",
      });
    }
    const density = typeof t3?.density === "string" ? t3.density : null;
    if (density === "compact") {
      uxPush(r, {
        code: "density.compact",
        level: "warning",
        message:
          "Compact плотность может ухудшить удобство на мобильных. Используйте с осторожностью.",
        path: "theme.tokensV3.density",
      });
    }
  } catch {
    // Never fail validation on optional V3 tokens.
  }

  return r;
}

