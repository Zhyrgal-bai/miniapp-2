import {
  isYandexDeliveryClaimsEnabled,
  isYandexDeliveryConfigured,
  isYandexDeliveryMockEnabled,
  getYandexDeliveryWebhookSecret,
} from "../providers/yandex/services/yandexDeliveryConfig.js";
import { isDeliveryRecoveryEnabled } from "./deliveryRecoveryConfig.js";
import type { ProviderDeliveryRepository } from "../repositories/providerDeliveryRepository.js";
import { createProviderDeliveryRepository } from "../repositories/providerDeliveryRepository.js";
import {
  ACTIVE_RECOVERY_STATUSES,
} from "../types/providerDeliveryTypes.js";
import { getDeliveryMetricsSnapshot } from "../utils/deliveryMetrics.js";
import { logDeliveryHealthCheck } from "../utils/deliveryRecoveryLogging.js";

export type DeliveryHealthSnapshot = {
  ok: boolean;
  provider: { yandex: { configured: boolean; mock: boolean } };
  oauth: { configured: boolean };
  claims: { enabled: boolean };
  webhook: { secretConfigured: boolean };
  tracking: { available: boolean };
  queue: { recoveryEnabled: boolean; dueCount: number };
  activeDeliveries: number;
  recoveringDeliveries: number;
  failedDeliveries: number;
  metrics: ReturnType<typeof getDeliveryMetricsSnapshot>;
};

export function createDeliveryHealthService(deps?: {
  repository?: ProviderDeliveryRepository;
  countDue?: (now: Date) => Promise<number>;
}) {
  const repository = deps?.repository ?? createProviderDeliveryRepository();
  const countDue =
    deps?.countDue ??
    (async (now: Date) => {
      const rows = await repository.findRecoveryRequiredDue(now, 1000);
      return rows.length;
    });

  async function getHealthSnapshot(): Promise<DeliveryHealthSnapshot> {
    const now = new Date();
    const [activeDeliveries, recoveringDeliveries, failedDeliveries, dueCount] =
      await Promise.all([
        repository.countByStatus([...ACTIVE_RECOVERY_STATUSES, "ACCEPTED"]),
        repository.countByStatus(["RECOVERY_REQUIRED"]),
        repository.countByStatus(["FAILED", "RECOVERY_REQUIRED"]),
        countDue(now),
      ]);

    const configured = isYandexDeliveryConfigured();
    const snapshot: DeliveryHealthSnapshot = {
      ok: configured,
      provider: {
        yandex: {
          configured,
          mock: isYandexDeliveryMockEnabled(),
        },
      },
      oauth: { configured },
      claims: { enabled: isYandexDeliveryClaimsEnabled() },
      webhook: { secretConfigured: getYandexDeliveryWebhookSecret() !== "" },
      tracking: { available: true },
      queue: {
        recoveryEnabled: isDeliveryRecoveryEnabled(),
        dueCount,
      },
      activeDeliveries,
      recoveringDeliveries,
      failedDeliveries,
      metrics: getDeliveryMetricsSnapshot(),
    };

    logDeliveryHealthCheck({
      ok: snapshot.ok,
      activeCount: activeDeliveries,
      recoveringCount: recoveringDeliveries,
      failedCount: failedDeliveries,
    });

    return snapshot;
  }

  return { getHealthSnapshot };
}

const defaultService = createDeliveryHealthService();

export async function getDeliveryHealthSnapshot(): Promise<DeliveryHealthSnapshot> {
  return defaultService.getHealthSnapshot();
}
