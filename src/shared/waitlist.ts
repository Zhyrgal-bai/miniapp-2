/**
 * Waitlist queue (Phase 6F).
 */

export type WaitlistEntryStatus =
  | "WAITING"
  | "INVITED"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED"
  | "SEATED"
  | "CANCELLED";

export const WAITLIST_INVITE_TIMEOUT_MINUTES = 15;

export const ACTIVE_WAITLIST_STATUSES: WaitlistEntryStatus[] = [
  "WAITING",
  "INVITED",
  "ACCEPTED",
];

export const WAITLIST_STATUS_LABELS: Record<WaitlistEntryStatus, string> = {
  WAITING: "В очереди",
  INVITED: "Приглашён",
  ACCEPTED: "Принял",
  DECLINED: "Отказался",
  EXPIRED: "Истекло",
  SEATED: "Посажен",
  CANCELLED: "Отменено",
};

export function waitlistStatusLabel(
  status: WaitlistEntryStatus | string | null | undefined,
): string {
  const key = String(status ?? "WAITING") as WaitlistEntryStatus;
  return WAITLIST_STATUS_LABELS[key] ?? key;
}

export function waitMinutesSince(iso: string, now = new Date()): number {
  const ms = now.getTime() - new Date(iso).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

export function formatWaitMinutes(minutes: number): string {
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
}
