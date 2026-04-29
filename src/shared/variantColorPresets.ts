/** Общие русские/англ названия → HEX (сервер + клиент). */
export const VARIANT_COLOR_MAP: Readonly<Record<string, string>> = {
  black: "#000000",
  white: "#ffffff",
  серый: "#808080",
  "светло-серый": "#d3d3d3",
  "темно-серый": "#404040",
  синий: "#0000ff",
  "темно-синий": "#00008b",
  голубой: "#87ceeb",
  красный: "#ff0000",
  бордовый: "#800000",
  апельсиновый: "#ffa500",
  молочный: "#fff8e7",
  кремовый: "#fffdd0",
  зеленый: "#00ff00",
  "темно-зеленый": "#006400",
  зелёный: "#00ff00",
  бежевый: "#f5f5dc",
  хаки: "#8a9a5b",
  песочный: "#c2b280",
  черный: "#000000",
  чёрный: "#000000",
  белый: "#ffffff",
  оранжевый: "#ff8c00",
  жёлтый: "#ffff00",
  желтый: "#ffff00",
  фиолетовый: "#8b00ff",
  розовый: "#ff69b4",
  серебристый: "#c0c0c0",
  золотой: "#ffd700",
  графитовый: "#41424c",
  лавандовый: "#e6e6fa",
  мятный: "#98ff98",
  лимонный: "#fffacd",
  шоколадный: "#7b3f00",
  вишнёвый: "#de3163",
  вишневый: "#de3163",
  индиго: "#4b0082",
  лиловый: "#c8a2c8",
  коралловый: "#ff7f50",
  бирюзовый: "#40e0d0",
  изумрудный: "#50c878",
  горчичный: "#ffdb58",
  терракотовый: "#e2725b",
  слоноваякость: "#fffff0",
  "слоновая кость": "#fffff0",
} as const;

export function expandShortHex(hex: string): string {
  const h = hex.trim();
  if (/^#[0-9a-f]{3}$/i.test(h)) {
    const r = h[1]!;
    const g = h[2]!;
    const b = h[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return h.toLowerCase();
}

export function isValidHexColor(hex: string): boolean {
  const h = hex.trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(h);
}

export function lookupVariantHexByName(name: string): string | null {
  const k = name.trim().toLowerCase();
  return VARIANT_COLOR_MAP[k] ?? null;
}
