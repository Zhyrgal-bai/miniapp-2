export type PreviewMode = "mobile" | "tablet" | "desktop";

export const PREVIEW_MODES: Array<{ id: PreviewMode; label: string; width: number }> = [
  { id: "mobile", label: "Mobile", width: 390 },
  { id: "tablet", label: "Tablet", width: 768 },
  { id: "desktop", label: "Desktop", width: 1280 },
];

export function modeWidth(mode: PreviewMode): number {
  const m = PREVIEW_MODES.find((x) => x.id === mode);
  return m?.width ?? 390;
}

