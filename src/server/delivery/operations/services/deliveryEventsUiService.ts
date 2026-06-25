import {
  createDeliveryTimelineRepository,
} from "../repositories/deliveryTimelineRepository.js";
import type { DeliveryUiEvent } from "../types/deliveryOperationsTypes.js";
import type { ProviderDeliveryStatus } from "../../types/providerDeliveryTypes.js";
import { incrementDeliveryMetric } from "../../utils/deliveryMetrics.js";
import { logDeliveryTimelineLoaded } from "../utils/deliveryOperationsLogging.js";

export function createDeliveryEventsUiService(deps?: {
  timelineRepo?: ReturnType<typeof createDeliveryTimelineRepository>;
}) {
  const timelineRepo = deps?.timelineRepo ?? createDeliveryTimelineRepository();

  function toUiEvent(row: {
    id: number;
    orderId: number;
    providerDeliveryId: number;
    provider: string;
    kind: string;
    title: string;
    detail: string | null;
    metadata: Record<string, unknown> | null;
    actor: string;
    createdAt: Date;
  }): DeliveryUiEvent {
    const status =
      row.metadata?.internalStatus != null
        ? (String(row.metadata.internalStatus) as ProviderDeliveryStatus)
        : null;

    return {
      id: `tl-${row.id}`,
      orderId: row.orderId,
      deliveryId: row.providerDeliveryId,
      provider: row.provider,
      kind: row.kind as DeliveryUiEvent["kind"],
      title: row.title,
      detail: row.detail,
      status,
      occurredAt: row.createdAt.toISOString(),
      actor: row.actor as DeliveryUiEvent["actor"],
    };
  }

  async function getEventsForOrder(
    orderId: number,
    actor: string,
  ): Promise<DeliveryUiEvent[]> {
    const rows = await timelineRepo.listByOrderId(orderId);
    incrementDeliveryMetric("delivery_timeline_total");
    logDeliveryTimelineLoaded({
      deliveryId: rows[0]?.providerDeliveryId ?? 0,
      eventCount: rows.length,
      actor,
    });
    return rows.map(toUiEvent);
  }

  async function getEventsForDelivery(
    deliveryId: number,
    actor: string,
  ): Promise<DeliveryUiEvent[]> {
    const rows = await timelineRepo.listByDeliveryId(deliveryId);
    incrementDeliveryMetric("delivery_timeline_total");
    logDeliveryTimelineLoaded({ deliveryId, eventCount: rows.length, actor });
    return rows.map(toUiEvent);
  }

  return { getEventsForOrder, getEventsForDelivery, toUiEvent };
}
