import type { DiningTableDto, DiningTableStatus } from "../../../services/diningTablesApi";

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function statusLabelRu(status: DiningTableStatus): string {
  switch (status) {
    case "AVAILABLE":
      return "свободен";
    case "SOON_OCCUPIED":
      return "скоро занят";
    case "OCCUPIED":
      return "занят";
    case "RESERVED":
      return "бронь";
    default:
      return status;
  }
}

export function formatReservationHint(table: DiningTableDto): string {
  const r = table.nextReservation;
  if (!r?.reservedAt) return statusLabelRu(table.status);
  const d = new Date(r.reservedAt);
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `бронь ${time}`;
}

export function listLineForTable(table: DiningTableDto): string {
  const hint =
    table.status === "RESERVED" || table.nextReservation
      ? formatReservationHint(table)
      : statusLabelRu(table.status);
  return `${table.name} • ${table.seats} мест • ${hint}`;
}
