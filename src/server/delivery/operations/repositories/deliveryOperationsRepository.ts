import type { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import type { ProviderDeliveryRecord } from "../../types/providerDeliveryTypes.js";
import type {
  DeliverySearchFilters,
  PaginatedResult,
} from "../types/deliveryOperationsTypes.js";
import type { ProviderDeliveryRepository } from "../../repositories/providerDeliveryRepository.js";
import { createProviderDeliveryRepository } from "../../repositories/providerDeliveryRepository.js";

export type DeliveryWithOrder = {
  delivery: ProviderDeliveryRecord;
  order: {
    id: number;
    orderNumber: string | null;
    name: string;
    phone: string;
    status: string;
    total: number;
    deliveryFee: number;
    createdAt: Date;
    businessId: number;
  };
  merchant: {
    id: number;
    name: string;
    slug: string | null;
  };
};

export type DeliveryOperationsRepository = {
  findById(id: number): Promise<DeliveryWithOrder | null>;
  findByIdForBusiness(
    id: number,
    businessId: number,
  ): Promise<DeliveryWithOrder | null>;
  search(
    filters: DeliverySearchFilters,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<DeliveryWithOrder>>;
  countByProvider(): Promise<Record<string, number>>;
  listRecoveryQueue(limit: number): Promise<ProviderDeliveryRecord[]>;
};

function mapDeliveryRow(row: {
  id: number;
  orderId: number;
  businessId: number;
  buyerUserId: number | null;
  provider: string;
  providerClaimId: string | null;
  providerOfferId: string;
  price: number | null;
  currency: string | null;
  status: string;
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
  order: {
    id: number;
    orderNumber: string | null;
    name: string;
    phone: string;
    status: string;
    total: number;
    deliveryFee: number;
    createdAt: Date;
    businessId: number;
  };
  business: {
    id: number;
    name: string;
    slug: string | null;
  };
}): DeliveryWithOrder {
  const delivery: ProviderDeliveryRecord = {
    id: row.id,
    orderId: row.orderId,
    businessId: row.businessId,
    buyerUserId: row.buyerUserId,
    provider: row.provider as ProviderDeliveryRecord["provider"],
    providerClaimId: row.providerClaimId,
    providerOfferId: row.providerOfferId,
    price: row.price,
    currency: row.currency,
    status: row.status as ProviderDeliveryRecord["status"],
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

  return {
    delivery,
    order: {
      id: row.order.id,
      orderNumber: row.order.orderNumber,
      name: row.order.name,
      phone: row.order.phone,
      status: row.order.status,
      total: row.order.total,
      deliveryFee: row.order.deliveryFee,
      createdAt: row.order.createdAt,
      businessId: row.order.businessId,
    },
    merchant: {
      id: row.business.id,
      name: row.business.name,
      slug: row.business.slug,
    },
  };
}

function buildSearchWhere(filters: DeliverySearchFilters): Prisma.ProviderDeliveryWhereInput {
  const where: Prisma.ProviderDeliveryWhereInput = {};

  if (filters.claimId?.trim()) {
    where.providerClaimId = { contains: filters.claimId.trim(), mode: "insensitive" };
  }
  if (filters.orderId != null) {
    where.orderId = filters.orderId;
  }
  if (filters.businessId != null) {
    where.businessId = filters.businessId;
  }
  if (filters.provider?.trim()) {
    where.provider = filters.provider.trim();
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.recoveryStatus === "recovery_required") {
    where.status = "RECOVERY_REQUIRED";
  } else if (filters.recoveryStatus === "recovering") {
    where.recoveryRetryCount = { gt: 0 };
    where.status = { not: "RECOVERY_REQUIRED" };
  } else if (filters.recoveryStatus === "none") {
    where.recoveryRetryCount = 0;
    where.status = { not: "RECOVERY_REQUIRED" };
  }
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };
  }
  if (filters.customerName?.trim() || filters.phone?.trim()) {
    where.order = {
      ...(filters.customerName?.trim()
        ? { name: { contains: filters.customerName.trim(), mode: "insensitive" } }
        : {}),
      ...(filters.phone?.trim()
        ? { phone: { contains: filters.phone.trim() } }
        : {}),
    };
  }

  return where;
}

export function createDeliveryOperationsRepository(deps?: {
  providerRepo?: ProviderDeliveryRepository;
}): DeliveryOperationsRepository {
  const providerRepo = deps?.providerRepo ?? createProviderDeliveryRepository();

  return {
    async findById(id) {
      const row = await prisma.providerDelivery.findUnique({
        where: { id },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              name: true,
              phone: true,
              status: true,
              total: true,
              deliveryFee: true,
              createdAt: true,
              businessId: true,
            },
          },
          business: { select: { id: true, name: true, slug: true } },
        },
      });
      return row ? mapDeliveryRow(row) : null;
    },

    async findByIdForBusiness(id, businessId) {
      const row = await prisma.providerDelivery.findFirst({
        where: { id, businessId },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              name: true,
              phone: true,
              status: true,
              total: true,
              deliveryFee: true,
              createdAt: true,
              businessId: true,
            },
          },
          business: { select: { id: true, name: true, slug: true } },
        },
      });
      return row ? mapDeliveryRow(row) : null;
    },

    async search(filters, page, pageSize) {
      const where = buildSearchWhere(filters);
      const skip = (page - 1) * pageSize;
      const [total, rows] = await Promise.all([
        prisma.providerDelivery.count({ where }),
        prisma.providerDelivery.findMany({
          where,
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                name: true,
                phone: true,
                status: true,
                total: true,
                deliveryFee: true,
                createdAt: true,
                businessId: true,
              },
            },
            business: { select: { id: true, name: true, slug: true } },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: pageSize,
        }),
      ]);

      return {
        items: rows.map(mapDeliveryRow),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    },

    async countByProvider() {
      const groups = await prisma.providerDelivery.groupBy({
        by: ["provider"],
        _count: { _all: true },
      });
      const out: Record<string, number> = {};
      for (const g of groups) {
        out[g.provider] = g._count._all;
      }
      return out;
    },

    async listRecoveryQueue(limit) {
      return providerRepo.findRecoveryRequiredDue(new Date(), limit);
    },
  };
}
