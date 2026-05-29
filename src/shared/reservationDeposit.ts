/**
 * Reservation deposit (Phase 6E).
 */

export type ReservationDepositStatus =
  | "NONE"
  | "DEPOSIT_PENDING"
  | "DEPOSIT_PAID"
  | "DEPOSIT_EXPIRED";

export const DEPOSIT_PAYMENT_TIMEOUT_MINUTES = 15;

export const PRESET_DEPOSIT_AMOUNTS_SOM = [100, 200, 500, 1000] as const;

export const RESERVATION_DEPOSIT_STATUS_LABELS: Record<
  ReservationDepositStatus,
  string
> = {
  NONE: "Не требуется",
  DEPOSIT_PENDING: "Ожидает оплату",
  DEPOSIT_PAID: "Оплачен",
  DEPOSIT_EXPIRED: "Истёк",
};

export type ReservationDepositSettings = {
  enabled: boolean;
  amountSom: number;
};

export function reservationDepositLabel(
  depositStatus: ReservationDepositStatus | null | undefined,
): string {
  const key = (depositStatus ?? "NONE") as ReservationDepositStatus;
  return RESERVATION_DEPOSIT_STATUS_LABELS[key] ?? RESERVATION_DEPOSIT_STATUS_LABELS.NONE;
}

export function parseReservationDepositAmount(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.round(n);
}

export function parseReservationDepositSettings(
  merchantConfig: unknown,
): ReservationDepositSettings {
  const cfg =
    merchantConfig != null &&
    typeof merchantConfig === "object" &&
    !Array.isArray(merchantConfig)
      ? (merchantConfig as Record<string, unknown>)
      : {};

  const enabled =
    cfg.reservationDepositEnabled === true ||
    cfg.reservationDepositEnabled === "true" ||
    cfg.reservationDepositEnabled === 1;

  const amountSom =
    parseReservationDepositAmount(cfg.reservationDepositAmountSom) ?? 500;

  return { enabled, amountSom };
}

export function reservationDepositExternalId(reservationId: number): string {
  return `res_deposit:${reservationId}`;
}

export function parseReservationDepositExternalId(
  externalId: string | null | undefined,
): number | null {
  if (externalId == null) return null;
  const m = /^res_deposit:(\d+)$/.exec(String(externalId).trim());
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
}

export function isReservationDepositBlockingPreorder(
  depositStatus: ReservationDepositStatus | null | undefined,
): boolean {
  return depositStatus === "DEPOSIT_PENDING" || depositStatus === "DEPOSIT_EXPIRED";
}
