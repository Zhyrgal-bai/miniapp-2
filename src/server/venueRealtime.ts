import { EventEmitter } from "node:events";

export type VenueRealtimePayload = {
  type: "floor" | "kitchen" | "session";
  businessId: number;
  at: string;
};

const hubs = new Map<number, EventEmitter>();

function hubFor(businessId: number): EventEmitter {
  let h = hubs.get(businessId);
  if (!h) {
    h = new EventEmitter();
    h.setMaxListeners(80);
    hubs.set(businessId, h);
  }
  return h;
}

export function publishVenueUpdate(
  businessId: number,
  type: VenueRealtimePayload["type"] = "floor",
): void {
  const payload: VenueRealtimePayload = {
    type,
    businessId,
    at: new Date().toISOString(),
  };
  hubFor(businessId).emit("update", payload);
}

export function subscribeVenueUpdates(
  businessId: number,
  listener: (payload: VenueRealtimePayload) => void,
): () => void {
  const hub = hubFor(businessId);
  const handler = (payload: VenueRealtimePayload) => listener(payload);
  hub.on("update", handler);
  return () => hub.off("update", handler);
}
