import type { ProviderDeliveryRepository } from "../repositories/providerDeliveryRepository.js";
import { createProviderDeliveryRepository } from "../repositories/providerDeliveryRepository.js";
import {
  ACTIVE_RECOVERY_STATUSES,
} from "../types/providerDeliveryTypes.js";

export type MerchantDeliveryDashboard = {
  active: number;
  searching: number;
  assigned: number;
  delivering: number;
  completedToday: number;
  cancelledToday: number;
  failedToday: number;
  averageEtaMinutes: number | null;
  averageDeliveryPrice: number | null;
};

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function createDeliveryMerchantDashboardService(deps?: {
  repository?: ProviderDeliveryRepository;
  todayStart?: () => Date;
}) {
  const repository = deps?.repository ?? createProviderDeliveryRepository();
  const todayStart = deps?.todayStart ?? startOfTodayUtc;

  async function getDashboard(businessId: number): Promise<MerchantDeliveryDashboard> {
    const since = todayStart();

    const [
      active,
      searching,
      assignedPickup,
      assignedAtPickup,
      pickedUp,
      delivering,
      completedToday,
      cancelledToday,
      failedToday,
      aggregates,
    ] = await Promise.all([
      repository.countByStatus([...ACTIVE_RECOVERY_STATUSES], businessId),
      repository.countByStatus(["SEARCHING_COURIER"], businessId),
      repository.countByStatus(["COURIER_ASSIGNED"], businessId),
      repository.countByStatus(["COURIER_AT_PICKUP"], businessId),
      repository.countByStatus(["PICKED_UP"], businessId),
      repository.countByStatus(["DELIVERING"], businessId),
      repository.countByBusinessAndStatuses(businessId, ["DELIVERED"], since),
      repository.countByBusinessAndStatuses(businessId, ["CANCELLED"], since),
      repository.countByBusinessAndStatuses(
        businessId,
        ["FAILED", "RECOVERY_REQUIRED"],
        since,
      ),
      repository.aggregateEtaAndPrice(businessId),
    ]);

    return {
      active,
      searching,
      assigned: assignedPickup + assignedAtPickup,
      delivering: pickedUp + delivering,
      completedToday,
      cancelledToday,
      failedToday,
      averageEtaMinutes: aggregates.avgEta,
      averageDeliveryPrice: aggregates.avgPrice,
    };
  }

  return { getDashboard };
}

const defaultService = createDeliveryMerchantDashboardService();

export async function getMerchantDeliveryDashboard(
  businessId: number,
): Promise<MerchantDeliveryDashboard> {
  return defaultService.getDashboard(businessId);
}
