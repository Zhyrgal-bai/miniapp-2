const KEY = "sf:tableSession";

export type StoredTableSession = {
  businessId: number;
  tableSessionId: number;
  tableName: string;
  qrToken?: string;
};

export function readTableSession(): StoredTableSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as StoredTableSession;
    if (
      !j ||
      !Number.isFinite(j.businessId) ||
      !Number.isFinite(j.tableSessionId)
    ) {
      return null;
    }
    return j;
  } catch {
    return null;
  }
}

export function writeTableSession(data: StoredTableSession): void {
  sessionStorage.setItem(KEY, JSON.stringify(data));
}

export function clearTableSession(): void {
  sessionStorage.removeItem(KEY);
}

export function readTableQrFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const sp = new URLSearchParams(window.location.search);
  const q = sp.get("tableQr")?.trim();
  if (q) return q;
  const hash = window.location.hash.replace(/^#/, "");
  if (hash.startsWith("table/")) return hash.slice("table/".length).trim();
  return null;
}
