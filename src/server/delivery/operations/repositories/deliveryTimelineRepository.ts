import type {
  AppendTimelineInput,
  DeliveryTimelineRecord,
} from "../types/deliveryOperationsTypes.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";

export type DeliveryTimelineRepository = {
  append(input: AppendTimelineInput): Promise<DeliveryTimelineRecord>;
  listByDeliveryId(
    providerDeliveryId: number,
    limit?: number,
  ): Promise<DeliveryTimelineRecord[]>;
  listByOrderId(orderId: number, limit?: number): Promise<DeliveryTimelineRecord[]>;
};

function mapRow(row: {
  id: number;
  providerDeliveryId: number;
  orderId: number;
  businessId: number;
  provider: string;
  kind: string;
  title: string;
  detail: string | null;
  metadata: unknown;
  actor: string;
  createdAt: Date;
}): DeliveryTimelineRecord {
  return {
    id: row.id,
    providerDeliveryId: row.providerDeliveryId,
    orderId: row.orderId,
    businessId: row.businessId,
    provider: row.provider,
    kind: row.kind as DeliveryTimelineRecord["kind"],
    title: row.title,
    detail: row.detail,
    metadata:
      row.metadata != null && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null,
    actor: row.actor as DeliveryTimelineRecord["actor"],
    createdAt: row.createdAt,
  };
}

export function createDeliveryTimelineRepository(): DeliveryTimelineRepository {
  return {
    async append(input) {
      const row = await prisma.deliveryTimelineEvent.create({
        data: {
          providerDeliveryId: input.providerDeliveryId,
          orderId: input.orderId,
          businessId: input.businessId,
          provider: input.provider,
          kind: input.kind,
          title: input.title,
          detail: input.detail ?? null,
          ...(input.metadata != null
            ? { metadata: input.metadata as Prisma.InputJsonValue }
            : {}),
          actor: input.actor ?? "SYSTEM",
        },
      });
      return mapRow(row);
    },

    async listByDeliveryId(providerDeliveryId, limit = 200) {
      const rows = await prisma.deliveryTimelineEvent.findMany({
        where: { providerDeliveryId },
        orderBy: { createdAt: "asc" },
        take: limit,
      });
      return rows.map(mapRow);
    },

    async listByOrderId(orderId, limit = 200) {
      const rows = await prisma.deliveryTimelineEvent.findMany({
        where: { orderId },
        orderBy: { createdAt: "asc" },
        take: limit,
      });
      return rows.map(mapRow);
    },
  };
}
