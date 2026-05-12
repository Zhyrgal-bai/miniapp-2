import { expandShortHex, isValidHexColor, lookupVariantHexByName } from "@repo-shared/variantColorPresets";

export {
  VARIANT_COLOR_MAP,
  expandShortHex,
  isValidHexColor,
  lookupVariantHexByName,
} from "@repo-shared/variantColorPresets";

export type VariantColorFields = {
  color: string;
  colorHex?: string | null;
};

export function variantColorName(v: {
  color: string | { name?: string } | unknown;
}): string {
  const c = v.color;
  if (typeof c === "string") return c;
  if (c && typeof c === "object" && "name" in (c as object)) {
    return String((c as { name: unknown }).name ?? "").trim();
  }
  return "";
}

/** HEX для `<input type="color" />` (только #rrggbb). */
export function resolvePickerHex(v: VariantColorFields): string {
  if (v.colorHex && isValidHexColor(v.colorHex)) {
    return expandShortHex(v.colorHex);
  }
  const mapped = lookupVariantHexByName(v.color);
  if (mapped) return expandShortHex(mapped);
  const c = v.color.trim();
  if (isValidHexColor(c)) return expandShortHex(c);
  return "#cccccc";
}

/** Фон свотча / CSS (HEX или HSL-фолбэк по названию). */
export function getVariantCssBackground(v: VariantColorFields): string {
  if (v.colorHex && isValidHexColor(v.colorHex)) {
    return expandShortHex(v.colorHex);
  }
  return variantColorToCss(v.color);
}

/** Легаси: строка названия или HEX → CSS. */
export function variantColorToCss(color: string): string {
  const c = color.trim();
  if (isValidHexColor(c)) {
    return expandShortHex(c);
  }
  const fromMap = lookupVariantHexByName(c);
  if (fromMap) return expandShortHex(fromMap);

  let h = 0;
  for (let i = 0; i < c.length; i++) {
    h = (h + c.charCodeAt(i) * (i + 17)) % 360;
  }
  return `hsl(${h}, 42%, 48%)`;
}
