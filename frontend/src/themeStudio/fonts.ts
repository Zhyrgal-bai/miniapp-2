export const FONT_ALLOWLIST = [
  { id: "system", title: "System", cssFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif" },
  { id: "inter", title: "Inter", cssFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif" },
  { id: "poppins", title: "Poppins", cssFamily: "Poppins, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif" },
  { id: "manrope", title: "Manrope", cssFamily: "Manrope, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif" },
  { id: "montserrat", title: "Montserrat", cssFamily: "Montserrat, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif" },
  { id: "bebasNeue", title: "Bebas Neue", cssFamily: "\"Bebas Neue\", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif" },
  { id: "playfairDisplay", title: "Playfair Display", cssFamily: "\"Playfair Display\", ui-serif, Georgia, Times New Roman, serif" },
] as const;

export type FontId = (typeof FONT_ALLOWLIST)[number]["id"];

export function isFontId(v: unknown): v is FontId {
  return typeof v === "string" && FONT_ALLOWLIST.some((f) => f.id === v);
}

