import type { DeliveryStage } from "@prisma/client";
import type { ProviderDeliveryStatus } from "../../../types/providerDeliveryTypes.js";

const STATUS_RANK: Record<ProviderDeliveryStatus, number> = {
  NEW: 0,
  CREATED: 10,
  ACCEPTED: 20,
  SEARCHING_COURIER: 30,
  COURIER_ASSIGNED: 40,
  COURIER_AT_PICKUP: 50,
  PICKED_UP: 60,
  DELIVERING: 70,
  DELIVERED: 80,
  CANCELLED: 90,
  FAILED: 90,
  RECOVERY_REQUIRED: 5,
};

/** Map raw Yandex claim status to ARCHA internal status. */
export function mapYandexStatusToInternal(
  yandexStatus: string,
): ProviderDeliveryStatus | null {
  const s = yandexStatus.trim().toLowerCase();
  if (s === "") return null;

  if (s === "new") return "CREATED";
  if (s === "accepted" || s === "performer_lookup") return "SEARCHING_COURIER";
  if (s === "performer_found" || s === "performer_draft") return "COURIER_ASSIGNED";
  if (s === "pickup_arrived" || s === "ready_for_pickup_confirmation") {
    return "COURIER_AT_PICKUP";
  }
  if (s === "pickuped" || s === "ready_for_delivery_confirmation") return "PICKED_UP";
  if (s === "delivery_arrived" || s === "delivering") return "DELIVERING";
  if (s === "delivered" || s === "delivered_finish") return "DELIVERED";

  if (
    s.startsWith("cancelled") ||
    s.startsWith("returned") ||
    s === "returning" ||
    s === "return_arrived" ||
    s === "ready_for_return_confirmation"
  ) {
    return "CANCELLED";
  }

  if (s === "failed" || s.endsWith("_failed") || s === "performer_not_found") {
    return "FAILED";
  }

  if (s === "estimating" || s === "ready_for_approval") return "CREATED";

  return null;
}

/** Map internal provider status to merchant/customer delivery stage. */
export function mapInternalStatusToDeliveryStage(
  status: ProviderDeliveryStatus,
): DeliveryStage | null {
  switch (status) {
    case "NEW":
    case "CREATED":
    case "ACCEPTED":
    case "SEARCHING_COURIER":
      return "PREPARING";
    case "COURIER_ASSIGNED":
    case "COURIER_AT_PICKUP":
      return "COURIER_DISPATCHED";
    case "PICKED_UP":
    case "DELIVERING":
      return "OUT_FOR_DELIVERY";
    case "DELIVERED":
      return "DELIVERED";
    case "CANCELLED":
    case "FAILED":
    case "RECOVERY_REQUIRED":
      return null;
    default:
      return null;
  }
}

export function statusRank(status: ProviderDeliveryStatus): number {
  return STATUS_RANK[status] ?? 0;
}

export function shouldAdvanceStatus(
  current: ProviderDeliveryStatus,
  incoming: ProviderDeliveryStatus,
): boolean {
  if (current === "RECOVERY_REQUIRED") {
    return incoming !== "RECOVERY_REQUIRED" && incoming !== "FAILED";
  }
  return statusRank(incoming) >= statusRank(current);
}
