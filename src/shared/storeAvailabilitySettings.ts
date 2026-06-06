/**
 * Phase 7: график работы, ETA, зоны доставки (отдельно от deliverySettings/pricing).
 */

export type WeekdayKey =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

export const WEEKDAY_KEYS: WeekdayKey[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

export const WEEKDAY_LABELS_RU: Record<WeekdayKey, string> = {
  mon: "Понедельник",
  tue: "Вторник",
  wed: "Среда",
  thu: "Четверг",
  fri: "Пятница",
  sat: "Суббота",
  sun: "Воскресенье",
};

export const WEEKDAY_SHORT_RU: Record<WeekdayKey, string> = {
  mon: "Пн",
  tue: "Вт",
  wed: "Ср",
  thu: "Чт",
  fri: "Пт",
  sat: "Сб",
  sun: "Вс",
};

export type DaySchedule = {
  closed: boolean;
  open: string;
  close: string;
};

export type EtaRange = {
  minMinutes: number;
  maxMinutes: number;
};

export type DeliveryZone = {
  id: string;
  title: string;
  minKm: number;
  maxKm: number | null;
  eta: EtaRange;
};

export type StoreAvailabilitySettings = {
  version: 1;
  timezone: string;
  schedule: Record<WeekdayKey, DaySchedule>;
  deliveryEta: EtaRange;
  pickupEta: EtaRange;
  deliveryZones: DeliveryZone[];
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  forceClosed?: boolean;
  forceOpen?: boolean;
  /** Минут до открытия/закрытия для OPENING_SOON / CLOSING_SOON. */
  soonThresholdMinutes?: number;
};

export type StoreAvailabilityStatus =
  | "OPEN"
  | "CLOSED"
  | "OPENING_SOON"
  | "CLOSING_SOON";

export type PublicDeliveryZone = {
  id: string;
  title: string;
  distanceLabel: string;
  etaLabel: string;
  minKm: number;
  maxKm: number | null;
  eta: EtaRange;
};

export type PublicWeeklyScheduleRow = {
  dayKey: WeekdayKey;
  dayLabel: string;
  hoursLabel: string;
  closed: boolean;
};

export type PublicStoreAvailability = {
  status: StoreAvailabilityStatus;
  isOpen: boolean;
  label: string;
  detail: string;
  timezone: string;
  deliveryEta: EtaRange;
  pickupEta: EtaRange;
  deliveryZones: PublicDeliveryZone[];
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  closedCheckoutNotice: string | null;
  nextOpenLabel: string | null;
  weeklySchedule: PublicWeeklyScheduleRow[];
};

const DEFAULT_TIMEZONE = "Asia/Bishkek";
const DEFAULT_SOON_MINUTES = 60;

const JS_DAY_TO_KEY: WeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function defaultDay(open = "09:00", close = "22:00", closed = false): DaySchedule {
  return { closed, open, close };
}

function defaultSchedule(): Record<WeekdayKey, DaySchedule> {
  return {
    mon: defaultDay(),
    tue: defaultDay(),
    wed: defaultDay(),
    sat: defaultDay("10:00", "23:00"),
    sun: defaultDay("09:00", "22:00", true),
    thu: defaultDay(),
    fri: defaultDay(),
  };
}

function defaultDeliveryZones(): DeliveryZone[] {
  return [
    {
      id: "zone_a",
      title: "Зона A",
      minKm: 0,
      maxKm: 3,
      eta: { minMinutes: 25, maxMinutes: 35 },
    },
    {
      id: "zone_b",
      title: "Зона B",
      minKm: 3,
      maxKm: 7,
      eta: { minMinutes: 35, maxMinutes: 50 },
    },
    {
      id: "zone_c",
      title: "Зона C",
      minKm: 7,
      maxKm: 15,
      eta: { minMinutes: 50, maxMinutes: 90 },
    },
  ];
}

export function defaultStoreAvailabilitySettings(): StoreAvailabilitySettings {
  return {
    version: 1,
    timezone: DEFAULT_TIMEZONE,
    schedule: defaultSchedule(),
    deliveryEta: { minMinutes: 25, maxMinutes: 40 },
    pickupEta: { minMinutes: 10, maxMinutes: 15 },
    deliveryZones: defaultDeliveryZones(),
    pickupEnabled: true,
    deliveryEnabled: true,
    soonThresholdMinutes: DEFAULT_SOON_MINUTES,
  };
}

export type StoreAvailabilityPresetId =
  | "coffee"
  | "clothing"
  | "fastfood"
  | "flowers"
  | "flowers_24_7";

export function storeAvailabilityPreset(
  id: StoreAvailabilityPresetId,
): StoreAvailabilitySettings {
  const base = defaultStoreAvailabilitySettings();
  const allDays = (open: string, close: string, sunClosed = false) => {
    const s = { ...base.schedule };
    for (const k of WEEKDAY_KEYS) {
      s[k] = defaultDay(open, close, k === "sun" && sunClosed);
    }
    return s;
  };

  switch (id) {
    case "coffee":
      return { ...base, schedule: allDays("08:00", "22:00") };
    case "clothing":
      return { ...base, schedule: allDays("10:00", "21:00") };
    case "fastfood":
      return { ...base, schedule: allDays("10:00", "23:00") };
    case "flowers":
      return { ...base, schedule: allDays("08:00", "21:00") };
    case "flowers_24_7":
      return { ...base, schedule: allDays("00:00", "23:59") };
    default:
      return base;
  }
}

export function presetForBusinessType(
  businessType: string | null | undefined,
): StoreAvailabilityPresetId {
  const t = String(businessType ?? "").toLowerCase();
  if (t === "coffee") return "coffee";
  if (t === "clothing") return "clothing";
  if (t === "fastfood") return "fastfood";
  if (t === "flowers") return "flowers";
  return "coffee";
}

function parseHm(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return null;
  }
  return h * 60 + min;
}

function parseEta(raw: unknown, fallback: EtaRange): EtaRange {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const o = raw as Record<string, unknown>;
  const min = Number(o.minMinutes);
  const max = Number(o.maxMinutes);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) {
    return fallback;
  }
  return { minMinutes: Math.round(min), maxMinutes: Math.round(max) };
}

function parseDay(raw: unknown, fallback: DaySchedule): DaySchedule {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const o = raw as Record<string, unknown>;
  const closed = o.closed === true;
  const open = String(o.open ?? fallback.open).trim();
  const close = String(o.close ?? fallback.close).trim();
  if (closed) return { closed: true, open, close };
  if (parseHm(open) == null || parseHm(close) == null) return fallback;
  return { closed: false, open, close };
}

function parseZone(raw: unknown, index: number): DeliveryZone | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const title = String(o.title ?? `Зона ${index + 1}`).trim();
  const minKm = Number(o.minKm ?? 0);
  const maxRaw = o.maxKm;
  const maxKm =
    maxRaw === null || maxRaw === undefined
      ? null
      : Number(maxRaw);
  if (!Number.isFinite(minKm) || minKm < 0) return null;
  if (maxKm != null && (!Number.isFinite(maxKm) || maxKm <= minKm)) return null;
  const eta = parseEta(o.eta, { minMinutes: 30, maxMinutes: 45 });
  const id =
    typeof o.id === "string" && o.id.trim() !== ""
      ? o.id.trim()
      : `zone_${index + 1}`;
  return { id, title, minKm, maxKm, eta };
}

export function parseStoreAvailabilitySettings(
  raw: unknown,
  businessType?: string | null,
): { ok: true; value: StoreAvailabilitySettings } | { ok: false; error: string } {
  const preset = storeAvailabilityPreset(presetForBusinessType(businessType));
  const base = defaultStoreAvailabilitySettings();
  if (raw == null || (typeof raw === "object" && Object.keys(raw as object).length === 0)) {
    return { ok: true, value: { ...preset, ...base, schedule: preset.schedule } };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Некорректные настройки графика работы." };
  }
  const o = raw as Record<string, unknown>;
  const timezone =
    typeof o.timezone === "string" && o.timezone.trim() !== ""
      ? o.timezone.trim()
      : DEFAULT_TIMEZONE;

  const schedule = { ...base.schedule };
  if (o.schedule != null && typeof o.schedule === "object" && !Array.isArray(o.schedule)) {
    const schedRaw = o.schedule as Record<string, unknown>;
    for (const k of WEEKDAY_KEYS) {
      schedule[k] = parseDay(schedRaw[k], schedule[k]);
    }
  } else if (preset.schedule) {
    Object.assign(schedule, preset.schedule);
  }

  let deliveryZones = base.deliveryZones;
  if (Array.isArray(o.deliveryZones)) {
    const parsed = o.deliveryZones
      .map((z, i) => parseZone(z, i))
      .filter((z): z is DeliveryZone => z != null);
    if (parsed.length > 0) deliveryZones = parsed;
  }

  const value: StoreAvailabilitySettings = {
    version: 1,
    timezone,
    schedule,
    deliveryEta: parseEta(o.deliveryEta, base.deliveryEta),
    pickupEta: parseEta(o.pickupEta, base.pickupEta),
    deliveryZones,
    pickupEnabled: o.pickupEnabled !== false,
    deliveryEnabled: o.deliveryEnabled !== false,
    forceClosed: o.forceClosed === true,
    forceOpen: o.forceOpen === true,
    soonThresholdMinutes:
      typeof o.soonThresholdMinutes === "number" && o.soonThresholdMinutes > 0
        ? Math.round(o.soonThresholdMinutes)
        : DEFAULT_SOON_MINUTES,
  };
  return { ok: true, value };
}

export function formatEtaRange(eta: EtaRange): string {
  if (eta.minMinutes === eta.maxMinutes) return `${eta.minMinutes} минут`;
  return `${eta.minMinutes}–${eta.maxMinutes} минут`;
}

export function formatZoneDistanceLabel(zone: DeliveryZone): string {
  if (zone.maxKm == null) return `${zone.minKm}+ км`;
  if (zone.minKm <= 0) return `0–${zone.maxKm} км`;
  return `${zone.minKm}–${zone.maxKm} км`;
}

type ZonedParts = {
  weekdayKey: WeekdayKey;
  hour: number;
  minute: number;
  nowMin: number;
};

function zonedParts(now: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase() ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const dayKey =
    JS_DAY_TO_KEY.find((d) => weekday.startsWith(d.slice(0, 3))) ?? "mon";
  return {
    weekdayKey: dayKey,
    hour,
    minute,
    nowMin: hour * 60 + minute,
  };
}

function isDayOpenNow(day: DaySchedule, nowMin: number): boolean {
  if (day.closed) return false;
  const openMin = parseHm(day.open);
  const closeMin = parseHm(day.close);
  if (openMin == null || closeMin == null) return false;
  if (closeMin > openMin) return nowMin >= openMin && nowMin < closeMin;
  return nowMin >= openMin || nowMin < closeMin;
}

function minutesUntilOpen(day: DaySchedule, nowMin: number): number | null {
  if (day.closed) return null;
  const openMin = parseHm(day.open);
  const closeMin = parseHm(day.close);
  if (openMin == null || closeMin == null) return null;
  if (isDayOpenNow(day, nowMin)) return 0;
  if (nowMin < openMin) return openMin - nowMin;
  return 24 * 60 - nowMin + openMin;
}

function minutesUntilClose(day: DaySchedule, nowMin: number): number | null {
  if (day.closed) return null;
  const openMin = parseHm(day.open);
  const closeMin = parseHm(day.close);
  if (openMin == null || closeMin == null) return null;
  if (!isDayOpenNow(day, nowMin)) return null;
  if (closeMin > openMin) return closeMin - nowMin;
  if (nowMin >= openMin) return 24 * 60 - nowMin + closeMin;
  return closeMin - nowMin;
}

function formatHmRu(hm: string): string {
  return hm.trim();
}

function nextOpenInfo(
  settings: StoreAvailabilitySettings,
  now: Date,
): { dayKey: WeekdayKey; open: string; daysAhead: number } | null {
  const { weekdayKey, nowMin } = zonedParts(now, settings.timezone);
  const startIdx = WEEKDAY_KEYS.indexOf(weekdayKey);
  for (let offset = 0; offset < 7; offset++) {
    const idx = (startIdx + offset) % 7;
    const key = WEEKDAY_KEYS[idx]!;
    const day = settings.schedule[key];
    if (day.closed) continue;
    const openMin = parseHm(day.open);
    if (openMin == null) continue;
    if (offset === 0 && nowMin >= openMin && isDayOpenNow(day, nowMin)) continue;
    if (offset === 0 && nowMin < openMin) {
      return { dayKey: key, open: day.open, daysAhead: 0 };
    }
    if (offset > 0) {
      return { dayKey: key, open: day.open, daysAhead: offset };
    }
    if (offset === 0 && !isDayOpenNow(day, nowMin)) {
      return { dayKey: key, open: day.open, daysAhead: 0 };
    }
  }
  return null;
}

function nextOpenLabel(
  settings: StoreAvailabilitySettings,
  now: Date,
): string | null {
  const info = nextOpenInfo(settings, now);
  if (info == null) return null;
  const hm = formatHmRu(info.open);
  if (info.daysAhead === 0) return `сегодня в ${hm}`;
  if (info.daysAhead === 1) return `завтра в ${hm}`;
  return `${WEEKDAY_SHORT_RU[info.dayKey]} в ${hm}`;
}

export function resolveStoreAvailabilityStatus(
  settings: StoreAvailabilitySettings,
  now = new Date(),
): {
  status: StoreAvailabilityStatus;
  isOpen: boolean;
  label: string;
  detail: string;
} {
  const soon = settings.soonThresholdMinutes ?? DEFAULT_SOON_MINUTES;
  if (settings.forceClosed) {
    const next = nextOpenLabel(settings, now);
    return {
      status: "CLOSED",
      isOpen: false,
      label: "🔴 Закрыто",
      detail: next != null ? `Откроется ${next}` : "Сейчас не принимаем заказы",
    };
  }
  if (settings.forceOpen) {
    const { weekdayKey, nowMin } = zonedParts(now, settings.timezone);
    const day = settings.schedule[weekdayKey];
    const closeIn = minutesUntilClose(day, nowMin);
    return {
      status: "OPEN",
      isOpen: true,
      label: "🟢 Сейчас открыто",
      detail:
        closeIn != null && day.close
          ? `До ${formatHmRu(day.close)}`
          : "Работаем",
    };
  }

  const { weekdayKey, nowMin } = zonedParts(now, settings.timezone);
  const day = settings.schedule[weekdayKey];

  if (day.closed) {
    const next = nextOpenLabel(settings, now);
    return {
      status: "CLOSED",
      isOpen: false,
      label: "🔴 Закрыто",
      detail: next != null ? `Откроется ${next}` : "Выходной",
    };
  }

  const open = isDayOpenNow(day, nowMin);
  const untilOpen = minutesUntilOpen(day, nowMin);
  const untilClose = minutesUntilClose(day, nowMin);

  if (open) {
    if (untilClose != null && untilClose <= soon) {
      return {
        status: "CLOSING_SOON",
        isOpen: true,
        label: "🟡 Скоро закроется",
        detail: `Закроется в ${formatHmRu(day.close)}`,
      };
    }
    return {
      status: "OPEN",
      isOpen: true,
      label: "🟢 Сейчас открыто",
      detail: `Закроется в ${formatHmRu(day.close)}`,
    };
  }

  if (untilOpen != null && untilOpen > 0 && untilOpen <= soon) {
    return {
      status: "OPENING_SOON",
      isOpen: false,
      label: "🟡 Скоро откроется",
      detail: `Откроется в ${formatHmRu(day.open)}`,
    };
  }

  const next = nextOpenLabel(settings, now);
  return {
    status: "CLOSED",
    isOpen: false,
    label: "🔴 Закрыто",
    detail: next != null ? `Откроется ${next}` : "Сейчас не работаем",
  };
}

export function resolveDeliveryZoneForKm(
  settings: StoreAvailabilitySettings,
  distanceKm: number | null,
): DeliveryZone | null {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return null;
  for (const z of settings.deliveryZones) {
    const withinMin = distanceKm >= z.minKm;
    const withinMax = z.maxKm == null || distanceKm < z.maxKm;
    if (withinMin && withinMax) return z;
  }
  const last = settings.deliveryZones[settings.deliveryZones.length - 1];
  return last ?? null;
}

export function resolveDeliveryEtaForKm(
  settings: StoreAvailabilitySettings,
  distanceKm: number | null,
): EtaRange {
  const zone = resolveDeliveryZoneForKm(settings, distanceKm);
  return zone?.eta ?? settings.deliveryEta;
}

export function etaMidMinutes(eta: EtaRange): number {
  return Math.round((eta.minMinutes + eta.maxMinutes) / 2);
}

export function buildClosedCheckoutNotice(
  settings: StoreAvailabilitySettings,
  now = new Date(),
): string | null {
  const st = resolveStoreAvailabilityStatus(settings, now);
  if (st.isOpen) return null;
  const next = nextOpenLabel(settings, now);
  if (next == null) {
    return "Магазин сейчас закрыт. Ваш заказ будет обработан при следующем открытии.";
  }
  return `Магазин сейчас закрыт. Ваш заказ будет обработан ${next}.`;
}

export function storeAvailabilityToPublic(
  settings: StoreAvailabilitySettings,
  now = new Date(),
): PublicStoreAvailability {
  const st = resolveStoreAvailabilityStatus(settings, now);
  const zones: PublicDeliveryZone[] = settings.deliveryZones.map((z) => ({
    id: z.id,
    title: z.title,
    distanceLabel: formatZoneDistanceLabel(z),
    etaLabel: formatEtaRange(z.eta),
    minKm: z.minKm,
    maxKm: z.maxKm,
    eta: z.eta,
  }));

  return {
    status: st.status,
    isOpen: st.isOpen,
    label: st.label,
    detail: st.detail,
    timezone: settings.timezone,
    deliveryEta: settings.deliveryEta,
    pickupEta: settings.pickupEta,
    deliveryZones: zones,
    pickupEnabled: settings.pickupEnabled,
    deliveryEnabled: settings.deliveryEnabled,
    closedCheckoutNotice: buildClosedCheckoutNotice(settings, now),
    nextOpenLabel: nextOpenLabel(settings, now),
    weeklySchedule: WEEKDAY_KEYS.map((dayKey) => {
      const row = settings.schedule[dayKey];
      return {
        dayKey,
        dayLabel: WEEKDAY_SHORT_RU[dayKey],
        hoursLabel: row.closed ? "Выходной" : `${row.open} – ${row.close}`,
        closed: row.closed,
      };
    }),
  };
}
