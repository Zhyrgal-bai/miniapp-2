/** Relative time in Russian for messenger-style lists. */
export function formatTimeAgoRu(iso: string | null | undefined): string {
  if (iso == null || iso.trim() === "") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "только что";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} д назад`;

  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}
