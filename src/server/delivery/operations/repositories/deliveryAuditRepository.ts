import type {
  AppendAuditInput,
  DeliveryAuditRecord,
} from "../types/deliveryOperationsTypes.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";

export type DeliveryAuditRepository = {
  append(input: AppendAuditInput): Promise<DeliveryAuditRecord>;
  listByDeliveryId(
    providerDeliveryId: number,
    limit?: number,
  ): Promise<DeliveryAuditRecord[]>;
  listByBusinessId(
    businessId: number,
    limit?: number,
  ): Promise<DeliveryAuditRecord[]>;
  listPlatform(limit?: number): Promise<DeliveryAuditRecord[]>;
};

function mapRow(row: {
  id: number;
  providerDeliveryId: number | null;
  orderId: number | null;
  businessId: number | null;
  provider: string | null;
  actor: string;
  actorId: string | null;
  action: string;
  details: unknown;
  createdAt: Date;
}): DeliveryAuditRecord {
  return {
    id: row.id,
    providerDeliveryId: row.providerDeliveryId,
    orderId: row.orderId,
    businessId: row.businessId,
    provider: row.provider,
    actor: row.actor as DeliveryAuditRecord["actor"],
    actorId: row.actorId,
    action: row.action,
    details:
      row.details != null && typeof row.details === "object"
        ? (row.details as Record<string, unknown>)
        : null,
    createdAt: row.createdAt,
  };
}

export function createDeliveryAuditRepository(): DeliveryAuditRepository {
  return {
    async append(input) {
      const row = await prisma.deliveryAuditLog.create({
        data: {
          providerDeliveryId: input.providerDeliveryId ?? null,
          orderId: input.orderId ?? null,
          businessId: input.businessId ?? null,
          provider: input.provider ?? null,
          actor: input.actor,
          actorId: input.actorId ?? null,
          action: input.action,
          ...(input.details != null
            ? { details: input.details as Prisma.InputJsonValue }
            : {}),
        },
      });
      return mapRow(row);
    },

    async listByDeliveryId(providerDeliveryId, limit = 200) {
      const rows = await prisma.deliveryAuditLog.findMany({
        where: { providerDeliveryId },
        orderBy: { createdAt: "asc" },
        take: limit,
      });
      return rows.map(mapRow);
    },

    async listByBusinessId(businessId, limit = 200) {
      const rows = await prisma.deliveryAuditLog.findMany({
        where: { businessId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return rows.map(mapRow);
    },

    async listPlatform(limit = 500) {
      const rows = await prisma.deliveryAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return rows.map(mapRow);
    },
  };
}
