import type { ProviderDeliveryStatus as PrismaProviderDeliveryStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import type {
  AppendStatusEventInput,
  AppendStatusEventResult,
  CreateProviderDeliveryInput,
  ProviderDeliveryRecord,
  ProviderDeliveryProviderId,
  ProviderDeliveryStatus,
  ProviderDeliveryStatusEventRecord,
  UpdateProviderDeliveryInput,
  UpdateRecoveryStateInput,
  UpdateTrackingSnapshotInput,
} from "../types/providerDeliveryTypes.js";

export type ProviderDeliveryRepository = {
  findByOrderId(orderId: number): Promise<ProviderDeliveryRecord | null>;
  findByProviderClaimId(claimId: string): Promise<ProviderDeliveryRecord | null>;
  findActiveForRecovery(
    states: ProviderDeliveryStatus[],
    limit: number,
    options?: { provider?: string; staleBefore?: Date },
  ): Promise<ProviderDeliveryRecord[]>;
  findRecoveryRequiredDue(now: Date, limit: number, provider?: string): Promise<ProviderDeliveryRecord[]>;
  countByStatus(statuses: ProviderDeliveryStatus[], businessId?: number): Promise<number>;
  countByBusinessAndStatuses(
    businessId: number,
    statuses: ProviderDeliveryStatus[],
    updatedSince?: Date,
  ): Promise<number>;
  aggregateEtaAndPrice(businessId: number): Promise<{ avgEta: number | null; avgPrice: number | null }>;
  create(input: CreateProviderDeliveryInput): Promise<ProviderDeliveryRecord>;
  update(
    id: number,
    input: UpdateProviderDeliveryInput,
  ): Promise<ProviderDeliveryRecord>;
  updateTrackingSnapshot(
    id: number,
    input: UpdateTrackingSnapshotInput,
  ): Promise<ProviderDeliveryRecord>;
  updateRecoveryState(
    id: number,
    input: UpdateRecoveryStateInput,
  ): Promise<ProviderDeliveryRecord>;
  clearRecoveryState(id: number): Promise<ProviderDeliveryRecord>;
  appendStatusEvent(input: AppendStatusEventInput): Promise<AppendStatusEventResult>;
};

type ProviderDeliveryRow = {
  id: number;
  orderId: number;
  businessId: number;
  buyerUserId: number | null;
  provider: string;
  providerClaimId: string | null;
  providerOfferId: string;
  price: number | null;
  currency: string | null;
  status: PrismaProviderDeliveryStatus;
  providerStatus: string | null;
  providerUpdatedAt: Date | null;
  courierName: string | null;
  courierPhone: string | null;
  vehicleNumber: string | null;
  etaMinutes: number | null;
  trackingUrl: string | null;
  courierLat: number | null;
  courierLng: number | null;
  lastWebhookKey: string | null;
  providerPayload: unknown;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  recoveryRetryCount: number;
  recoveryNextRetryAt: Date | null;
  recoveryLastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapRow(row: ProviderDeliveryRow): ProviderDeliveryRecord {
  return {
    id: row.id,
    orderId: row.orderId,
    businessId: row.businessId,
    buyerUserId: row.buyerUserId,
    provider: row.provider as ProviderDeliveryProviderId,
    providerClaimId: row.providerClaimId,
    providerOfferId: row.providerOfferId,
    price: row.price,
    currency: row.currency,
    status: row.status as ProviderDeliveryStatus,
    providerStatus: row.providerStatus,
    providerUpdatedAt: row.providerUpdatedAt,
    courierName: row.courierName,
    courierPhone: row.courierPhone,
    vehicleNumber: row.vehicleNumber,
    etaMinutes: row.etaMinutes,
    trackingUrl: row.trackingUrl,
    courierLat: row.courierLat,
    courierLng: row.courierLng,
    lastWebhookKey: row.lastWebhookKey,
    providerPayload: row.providerPayload,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    recoveryRetryCount: row.recoveryRetryCount,
    recoveryNextRetryAt: row.recoveryNextRetryAt,
    recoveryLastError: row.recoveryLastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapEventRow(row: {
  id: number;
  providerDeliveryId: number;
  providerStatus: string;
  internalStatus: PrismaProviderDeliveryStatus;
  providerUpdatedAt: Date;
  webhookKey: string;
  courierName: string | null;
  vehicleNumber: string | null;
  etaMinutes: number | null;
  createdAt: Date;
}): ProviderDeliveryStatusEventRecord {
  return {
    id: row.id,
    providerDeliveryId: row.providerDeliveryId,
    providerStatus: row.providerStatus,
    internalStatus: row.internalStatus as ProviderDeliveryStatus,
    providerUpdatedAt: row.providerUpdatedAt,
    webhookKey: row.webhookKey,
    courierName: row.courierName,
    vehicleNumber: row.vehicleNumber,
    etaMinutes: row.etaMinutes,
    createdAt: row.createdAt,
  };
}

export function createProviderDeliveryRepository(deps?: {
  db?: typeof prisma;
}): ProviderDeliveryRepository {
  const db = deps?.db ?? prisma;

  return {
    async findByOrderId(orderId: number) {
      const row = await db.providerDelivery.findUnique({ where: { orderId } });
      return row ? mapRow(row) : null;
    },

    async findByProviderClaimId(claimId: string) {
      const id = claimId.trim();
      if (id === "") return null;
      const row = await db.providerDelivery.findFirst({
        where: { providerClaimId: id },
      });
      return row ? mapRow(row) : null;
    },

    async findActiveForRecovery(states, limit, options) {
      const rows = await db.providerDelivery.findMany({
        where: {
          status: { in: states as PrismaProviderDeliveryStatus[] },
          providerClaimId: { not: null },
          ...(options?.provider ? { provider: options.provider } : {}),
          ...(options?.staleBefore
            ? {
                OR: [
                  { providerUpdatedAt: null },
                  { providerUpdatedAt: { lt: options.staleBefore } },
                ],
              }
            : {}),
        },
        take: limit,
        orderBy: { providerUpdatedAt: "asc" },
      });
      return rows.map(mapRow);
    },

    async findRecoveryRequiredDue(now, limit, provider) {
      const rows = await db.providerDelivery.findMany({
        where: {
          OR: [
            {
              status: "RECOVERY_REQUIRED" as PrismaProviderDeliveryStatus,
              ...(provider ? { provider } : {}),
            },
            {
              recoveryNextRetryAt: { lte: now },
              recoveryRetryCount: { gt: 0 },
              ...(provider ? { provider } : {}),
            },
          ],
        },
        take: limit,
        orderBy: { recoveryNextRetryAt: "asc" },
      });
      return rows.map(mapRow);
    },

    async countByStatus(statuses, businessId) {
      return db.providerDelivery.count({
        where: {
          status: { in: statuses as PrismaProviderDeliveryStatus[] },
          ...(businessId != null ? { businessId } : {}),
        },
      });
    },

    async countByBusinessAndStatuses(businessId, statuses, updatedSince) {
      return db.providerDelivery.count({
        where: {
          businessId,
          status: { in: statuses as PrismaProviderDeliveryStatus[] },
          ...(updatedSince ? { providerUpdatedAt: { gte: updatedSince } } : {}),
        },
      });
    },

    async aggregateEtaAndPrice(businessId) {
      const agg = await db.providerDelivery.aggregate({
        where: {
          businessId,
          OR: [{ etaMinutes: { not: null } }, { price: { not: null } }],
        },
        _avg: { etaMinutes: true, price: true },
      });
      return {
        avgEta:
          agg._avg.etaMinutes != null ? Math.round(agg._avg.etaMinutes) : null,
        avgPrice:
          agg._avg.price != null ? Math.round(agg._avg.price) : null,
      };
    },

    async create(input: CreateProviderDeliveryInput) {
      const row = await db.providerDelivery.create({
        data: {
          orderId: input.orderId,
          businessId: input.businessId,
          buyerUserId: input.buyerUserId,
          provider: input.provider,
          providerOfferId: input.providerOfferId,
          status: (input.status ?? "NEW") as PrismaProviderDeliveryStatus,
          ...(input.price != null ? { price: input.price } : {}),
          ...(input.currency != null ? { currency: input.currency } : {}),
          ...(input.lastErrorCode !== undefined
            ? { lastErrorCode: input.lastErrorCode }
            : {}),
          ...(input.lastErrorMessage !== undefined
            ? { lastErrorMessage: input.lastErrorMessage }
            : {}),
        },
      });
      return mapRow(row);
    },

    async update(id: number, input: UpdateProviderDeliveryInput) {
      const row = await db.providerDelivery.update({
        where: { id },
        data: {
          ...(input.status != null
            ? { status: input.status as PrismaProviderDeliveryStatus }
            : {}),
          ...(input.providerClaimId !== undefined
            ? { providerClaimId: input.providerClaimId }
            : {}),
          ...(input.providerPayload !== undefined
            ? { providerPayload: input.providerPayload as object }
            : {}),
          ...(input.price !== undefined ? { price: input.price } : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.lastErrorCode !== undefined
            ? { lastErrorCode: input.lastErrorCode }
            : {}),
          ...(input.lastErrorMessage !== undefined
            ? { lastErrorMessage: input.lastErrorMessage }
            : {}),
        },
      });
      return mapRow(row);
    },

    async updateTrackingSnapshot(id: number, input: UpdateTrackingSnapshotInput) {
      const row = await db.providerDelivery.update({
        where: { id },
        data: {
          status: input.status as PrismaProviderDeliveryStatus,
          providerStatus: input.providerStatus,
          providerUpdatedAt: input.providerUpdatedAt,
          lastWebhookKey: input.lastWebhookKey,
          ...(input.courierName !== undefined ? { courierName: input.courierName } : {}),
          ...(input.courierPhone !== undefined ? { courierPhone: input.courierPhone } : {}),
          ...(input.vehicleNumber !== undefined ? { vehicleNumber: input.vehicleNumber } : {}),
          ...(input.etaMinutes !== undefined ? { etaMinutes: input.etaMinutes } : {}),
          ...(input.trackingUrl !== undefined ? { trackingUrl: input.trackingUrl } : {}),
          ...(input.courierLat !== undefined ? { courierLat: input.courierLat } : {}),
          ...(input.courierLng !== undefined ? { courierLng: input.courierLng } : {}),
        },
      });
      return mapRow(row);
    },

    async updateRecoveryState(id: number, input: UpdateRecoveryStateInput) {
      const row = await db.providerDelivery.update({
        where: { id },
        data: {
          ...(input.recoveryRetryCount !== undefined
            ? { recoveryRetryCount: input.recoveryRetryCount }
            : {}),
          ...(input.recoveryNextRetryAt !== undefined
            ? { recoveryNextRetryAt: input.recoveryNextRetryAt }
            : {}),
          ...(input.recoveryLastError !== undefined
            ? { recoveryLastError: input.recoveryLastError }
            : {}),
          ...(input.status != null
            ? { status: input.status as PrismaProviderDeliveryStatus }
            : {}),
        },
      });
      return mapRow(row);
    },

    async clearRecoveryState(id: number) {
      const row = await db.providerDelivery.update({
        where: { id },
        data: {
          recoveryRetryCount: 0,
          recoveryNextRetryAt: null,
          recoveryLastError: null,
        },
      });
      return mapRow(row);
    },

    async appendStatusEvent(input: AppendStatusEventInput): Promise<AppendStatusEventResult> {
      try {
        const row = await db.providerDeliveryStatusEvent.create({
          data: {
            providerDeliveryId: input.providerDeliveryId,
            providerStatus: input.providerStatus,
            internalStatus: input.internalStatus as PrismaProviderDeliveryStatus,
            providerUpdatedAt: input.providerUpdatedAt,
            webhookKey: input.webhookKey,
            ...(input.courierName !== undefined ? { courierName: input.courierName } : {}),
            ...(input.vehicleNumber !== undefined ? { vehicleNumber: input.vehicleNumber } : {}),
            ...(input.etaMinutes !== undefined ? { etaMinutes: input.etaMinutes } : {}),
          },
        });
        return { ok: true, duplicate: false, event: mapEventRow(row) };
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          return { ok: true, duplicate: true };
        }
        return {
          ok: false,
          error: e instanceof Error ? e.message : "appendStatusEvent failed",
        };
      }
    },
  };
}

export const defaultProviderDeliveryRepository = createProviderDeliveryRepository();
