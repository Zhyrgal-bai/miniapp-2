import { EventEmitter } from "node:events";
import type { ProviderDeliveryStatus } from "../types/providerDeliveryTypes.js";

export type DeliveryEventName =
  | "delivery_created"
  | "delivery_status_changed"
  | "courier_assigned"
  | "delivery_completed"
  | "delivery_cancelled";

export type DeliveryEventPayload = {
  orderId: number;
  businessId: number;
  provider: "yandex";
  internalStatus: ProviderDeliveryStatus;
  previousStatus?: ProviderDeliveryStatus;
};

type DeliveryEventHandler = (event: DeliveryEventName, payload: DeliveryEventPayload) => void;

const bus = new EventEmitter();
bus.setMaxListeners(50);

export function emitDeliveryEvent(
  event: DeliveryEventName,
  payload: DeliveryEventPayload,
): void {
  bus.emit(event, payload);
  if (event !== "delivery_status_changed") {
    bus.emit("delivery_status_changed", payload);
  }
}

export function subscribeDeliveryEvents(handler: DeliveryEventHandler): () => void {
  const names: DeliveryEventName[] = [
    "delivery_created",
    "delivery_status_changed",
    "courier_assigned",
    "delivery_completed",
    "delivery_cancelled",
  ];
  for (const name of names) {
    bus.on(name, (payload: DeliveryEventPayload) => handler(name, payload));
  }
  return () => {
    for (const name of names) {
      bus.off(name, handler as (...args: unknown[]) => void);
    }
  };
}

export function deliveryEventNameForStatus(
  status: ProviderDeliveryStatus,
): DeliveryEventName | null {
  switch (status) {
    case "COURIER_ASSIGNED":
      return "courier_assigned";
    case "DELIVERED":
      return "delivery_completed";
    case "CANCELLED":
    case "FAILED":
      return "delivery_cancelled";
    default:
      return null;
  }
}
