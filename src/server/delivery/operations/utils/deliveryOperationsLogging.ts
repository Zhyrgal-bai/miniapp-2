import { emitStructuredLog } from "../../../structuredLog.js";

export function logDeliveryOpened(fields: {
  deliveryId: number;
  orderId: number;
  actor: string;
}): void {
  emitStructuredLog("info", "delivery_opened", fields);
}

export function logDeliveryRefreshed(fields: {
  deliveryId: number;
  orderId: number;
  force: boolean;
  actor: string;
}): void {
  emitStructuredLog("info", "delivery_refreshed", fields);
}

export function logDeliveryExported(fields: {
  exportType: string;
  format: string;
  rowCount: number;
  actor: string;
}): void {
  emitStructuredLog("info", "delivery_exported", fields);
}

export function logDeliverySearched(fields: {
  resultCount: number;
  page: number;
  actor: string;
}): void {
  emitStructuredLog("info", "delivery_searched", fields);
}

export function logDeliveryTimelineLoaded(fields: {
  deliveryId: number;
  eventCount: number;
  actor: string;
}): void {
  emitStructuredLog("info", "delivery_timeline_loaded", fields);
}
