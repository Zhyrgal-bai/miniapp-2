/** Client-side store open/closed badge from optional storefront text config. */

export type StoreOpenStatus = {
  isOpen: boolean;
  label: string;
  detail?: string;
};

type WeeklySlot = { open: string; close: string };
type WeeklySchedule = Partial<Record<string, WeeklySlot>>;

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function readText(cfg: Record<string, unknown> | undefined, key: string): string {
  const v = cfg?.[key];
  return typeof v === "string" ? v.trim() : "";
}

function parseWeeklySchedule(raw: string): WeeklySchedule | null {
  if (raw === "") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as WeeklySchedule;
  } catch {
    return null;
  }
}

function parseHm(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return null;
  }
  return h * 60 + min;
}

function isOpenBySchedule(schedule: WeeklySchedule, now: Date, timeZone: string): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase().slice(0, 3) ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const dayKey = DAY_KEYS.find((d) => weekday.startsWith(d.slice(0, 3))) ?? "";
  const slot = schedule[dayKey];
  if (!slot) return false;
  const openMin = parseHm(slot.open);
  const closeMin = parseHm(slot.close);
  if (openMin == null || closeMin == null) return false;
  const nowMin = hour * 60 + minute;
  if (closeMin > openMin) return nowMin >= openMin && nowMin < closeMin;
  return nowMin >= openMin || nowMin < closeMin;
}

/** Resolve storefront badge; defaults to open when vitrine is live. */
export function resolveStoreOpenStatus(
  textConfig: Record<string, unknown> | undefined,
  now = new Date(),
): StoreOpenStatus {
  const openLabel = readText(textConfig, "storeStatusOpenLabel") || "🟢 Открыт";
  const closedLabel = readText(textConfig, "storeStatusClosedLabel") || "🔴 Закрыт";
  const hoursNote = readText(textConfig, "storeHoursNote");
  const forceClosed = readText(textConfig, "storeForceClosed").toLowerCase() === "true";
  const forceOpen = readText(textConfig, "storeForceOpen").toLowerCase() === "true";
  const timeZone = readText(textConfig, "storeTimeZone") || "Asia/Bishkek";
  const schedule = parseWeeklySchedule(readText(textConfig, "storeWeeklyHours"));

  if (forceClosed) {
    return { isOpen: false, label: closedLabel, detail: hoursNote || undefined };
  }
  if (forceOpen) {
    return { isOpen: true, label: openLabel, detail: hoursNote || undefined };
  }
  if (schedule != null) {
    const isOpen = isOpenBySchedule(schedule, now, timeZone);
    return {
      isOpen,
      label: isOpen ? openLabel : closedLabel,
      detail: hoursNote || undefined,
    };
  }
  return { isOpen: true, label: openLabel, detail: hoursNote || undefined };
}
