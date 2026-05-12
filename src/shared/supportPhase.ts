/** UI phase for guided support actions (maps from real OrderStatus). */
export type SupportPhase = "PROCESSING" | "SHIPPING" | "DELIVERED" | "CANCELLED";

export function orderSupportPhase(status: string): SupportPhase {
  switch (status) {
    case "NEW":
    case "ACCEPTED":
    case "PAID_PENDING":
    case "CONFIRMED":
      return "PROCESSING";
    case "SHIPPED":
      return "SHIPPING";
    case "DELIVERED":
      return "DELIVERED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "PROCESSING";
  }
}
