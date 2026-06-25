import type {
  CustomerDeliveryTrackingView,
  MerchantDeliveryTrackingView,
  ProviderDeliveryRecord,
} from "../types/providerDeliveryTypes.js";
import type { ProviderDeliveryRepository } from "../repositories/providerDeliveryRepository.js";
import { createProviderDeliveryRepository } from "../repositories/providerDeliveryRepository.js";
import { prisma } from "../../db.js";

export type DeliveryTrackingAudience = "customer" | "merchant";

export type DeliveryTrackingResult =
  | { ok: true; tracking: CustomerDeliveryTrackingView | MerchantDeliveryTrackingView }
  | { ok: false; code: "not_found"; message: string };

function toIso(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString();
}

function mapCustomerView(record: ProviderDeliveryRecord): CustomerDeliveryTrackingView {
  return {
    provider: record.provider,
    status: record.status,
    etaMinutes: record.etaMinutes,
    courier: {
      name: record.courierName,
      vehicle: record.vehicleNumber,
    },
    trackingUrl: record.trackingUrl,
    updatedAt: toIso(record.providerUpdatedAt ?? record.updatedAt),
  };
}

function mapMerchantView(
  record: ProviderDeliveryRecord,
  deliveryStage: string | null,
): MerchantDeliveryTrackingView {
  const base = mapCustomerView(record);
  return {
    ...base,
    providerStatus: record.providerStatus,
    providerClaimId: record.providerClaimId,
    price: record.price,
    currency: record.currency,
    deliveryStage,
    courier: {
      name: record.courierName,
      phone: record.courierPhone,
      vehicle: record.vehicleNumber,
    },
    createdAt: record.createdAt.toISOString(),
    updatedAt: toIso(record.providerUpdatedAt ?? record.updatedAt) ?? record.updatedAt.toISOString(),
  };
}

export type DeliveryTrackingServiceDeps = {
  repository?: ProviderDeliveryRepository;
  loadOrderStage?: (orderId: number) => Promise<string | null>;
};

export function createDeliveryTrackingService(deps: DeliveryTrackingServiceDeps = {}) {
  const repository = deps.repository ?? createProviderDeliveryRepository();
  const loadOrderStage =
    deps.loadOrderStage ??
    (async (orderId: number) => {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { deliveryStage: true },
      });
      return order?.deliveryStage ?? null;
    });

  async function getTrackingForOrder(
    orderId: number,
    audience: DeliveryTrackingAudience,
  ): Promise<DeliveryTrackingResult> {
    const record = await repository.findByOrderId(orderId);
    if (!record) {
      return { ok: false, code: "not_found", message: "Доставка не найдена." };
    }

    if (audience === "customer") {
      return { ok: true, tracking: mapCustomerView(record) };
    }

    const deliveryStage = await loadOrderStage(orderId);
    return {
      ok: true,
      tracking: mapMerchantView(record, deliveryStage),
    };
  }

  return { getTrackingForOrder };
}

const defaultService = createDeliveryTrackingService();

export async function getTrackingForOrder(
  orderId: number,
  audience: DeliveryTrackingAudience,
): Promise<DeliveryTrackingResult> {
  return defaultService.getTrackingForOrder(orderId, audience);
}
