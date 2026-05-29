const KEY = "sf:preorderContext";

export type StoredPreorderContext = {
  businessId: number;
  reservationId: number;
  tableName: string;
  reservedAt: string;
  partySize: number | null;
  hasPreorder: boolean;
};

export function readReservationIdFromLocation(): number | null {
  if (typeof window === "undefined") return null;
  const sp = new URLSearchParams(window.location.search);
  const raw = sp.get("reservationId")?.trim();
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
}

export function stripReservationIdFromLocation(): void {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  if (!u.searchParams.has("reservationId")) return;
  u.searchParams.delete("reservationId");
  window.history.replaceState({}, "", u.pathname + u.search + u.hash);
}

export function readPreorderContext(): StoredPreorderContext | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as StoredPreorderContext;
    if (
      !j ||
      !Number.isFinite(j.businessId) ||
      !Number.isFinite(j.reservationId) ||
      typeof j.tableName !== "string" ||
      typeof j.reservedAt !== "string"
    ) {
      return null;
    }
    return j;
  } catch {
    return null;
  }
}

export function writePreorderContext(data: StoredPreorderContext): void {
  sessionStorage.setItem(KEY, JSON.stringify(data));
}

export function clearPreorderContext(): void {
  sessionStorage.removeItem(KEY);
}

export function formatPreorderWhen(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }),
    time: d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
  };
}
