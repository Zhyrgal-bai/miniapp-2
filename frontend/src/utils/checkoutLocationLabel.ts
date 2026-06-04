import { t } from "../i18n";

/** Человекочитаемый статус геолокации на checkout (без lat/lng). */
export function checkoutLocationLabel(address: string): string {
  const trimmed = address.trim();
  if (trimmed !== "") {
    return `📍 ${trimmed}`;
  }
  return `📍 ${t("checkout.locationResolved")}`;
}
