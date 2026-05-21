/** Delivery phases for customer trust UX. */

export type DeliveryMode = "PICKUP" | "DELIVERY";

export type DeliveryStage =
  | "PREPARING"
  | "COURIER_DISPATCHED"
  | "OUT_FOR_DELIVERY"
  | "NEARBY"
  | "DELIVERED";

export type DeliveryTimelineStep = {
  icon: string;
  label: string;
  done: boolean;
  current: boolean;
};

const STAGE_ORDER: DeliveryStage[] = [
  "PREPARING",
  "COURIER_DISPATCHED",
  "OUT_FOR_DELIVERY",
  "NEARBY",
  "DELIVERED",
];

export function deliveryStageLabelRu(stage: DeliveryStage | null | undefined): string {
  switch (stage) {
    case "PREPARING":
      return "Собираем заказ";
    case "COURIER_DISPATCHED":
      return "Курьер выехал";
    case "OUT_FOR_DELIVERY":
      return "В пути";
    case "NEARBY":
      return "Почти доставлено";
    case "DELIVERED":
      return "Доставлено";
    default:
      return "Готовим";
  }
}

export function deliveryModeLabelRu(mode: DeliveryMode | null | undefined): string {
  return mode === "PICKUP" ? "Самовывоз" : "Доставка";
}

export function deliveryTimelineSteps(input: {
  deliveryMode?: DeliveryMode | null;
  deliveryStage?: DeliveryStage | null;
  orderStatus?: string;
}): DeliveryTimelineStep[] {
  const mode = input.deliveryMode ?? "DELIVERY";
  const status = String(input.orderStatus ?? "").toUpperCase();
  const stage = input.deliveryStage ?? inferDeliveryStage(status);

  if (status === "CANCELLED") {
    return [{ icon: "❌", label: "Отменён", done: true, current: true }];
  }

  if (mode === "PICKUP") {
    const pickupSteps: Array<{ stage: DeliveryStage; icon: string; label: string }> = [
      { stage: "PREPARING", icon: "📦", label: "Собираем заказ" },
      { stage: "DELIVERED", icon: "🎉", label: "Готов к выдаче" },
    ];
    const idx = stage === "DELIVERED" ? 1 : 0;
    return pickupSteps.map((s, i) => ({
      icon: s.icon,
      label: s.label,
      done: i <= idx,
      current: i === idx,
    }));
  }

  const labels: Array<{ stage: DeliveryStage; icon: string; label: string }> = [
    { stage: "PREPARING", icon: "📦", label: "Собираем заказ" },
    { stage: "COURIER_DISPATCHED", icon: "🛵", label: "Курьер выехал" },
    { stage: "OUT_FOR_DELIVERY", icon: "🚚", label: "В пути" },
    { stage: "NEARBY", icon: "📍", label: "Почти доставлено" },
    { stage: "DELIVERED", icon: "🎉", label: "Доставлено" },
  ];

  const stageIdx = STAGE_ORDER.indexOf(stage);
  const currentIdx = stageIdx >= 0 ? stageIdx : 0;

  return labels.map((s, i) => ({
    icon: s.icon,
    label: s.label,
    done: i <= currentIdx || status === "DELIVERED",
    current: i === currentIdx && status !== "DELIVERED",
  }));
}

export function inferDeliveryStage(orderStatus: string): DeliveryStage {
  const u = String(orderStatus ?? "").trim().toUpperCase();
  if (u === "DELIVERED") return "DELIVERED";
  if (u === "SHIPPED") return "OUT_FOR_DELIVERY";
  if (u === "CONFIRMED") return "PREPARING";
  return "PREPARING";
}

export function defaultPreparationMinutes(mode: DeliveryMode): number {
  return mode === "PICKUP" ? 30 : 45;
}

export function estimateDeliveryAt(
  from: Date,
  preparationMinutes: number,
  mode: DeliveryMode
): Date {
  const extra = mode === "PICKUP" ? 0 : 60;
  return new Date(from.getTime() + (preparationMinutes + extra) * 60_000);
}
