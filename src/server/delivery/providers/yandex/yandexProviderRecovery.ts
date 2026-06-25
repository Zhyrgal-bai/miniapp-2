import type { ProviderRecoveryPort } from "../deliveryProviderRecoveryPort.js";
import {
  createDeliveryRefreshService,
  type DeliveryRefreshService,
} from "../../services/DeliveryRefreshService.js";
import {
  ACTIVE_RECOVERY_STATUSES,
} from "../../types/providerDeliveryTypes.js";
import type { ProviderDeliveryRepository } from "../../repositories/providerDeliveryRepository.js";
import { createProviderDeliveryRepository } from "../../repositories/providerDeliveryRepository.js";
import {
  getDeliveryRecoveryStaleMs,
} from "../../services/deliveryRecoveryConfig.js";

export class YandexProviderRecovery implements ProviderRecoveryPort {
  readonly providerId = "yandex";

  private readonly repository: ProviderDeliveryRepository;
  private readonly refreshService: DeliveryRefreshService;

  constructor(deps?: {
    repository?: ProviderDeliveryRepository;
    refreshService?: DeliveryRefreshService;
  }) {
    this.repository = deps?.repository ?? createProviderDeliveryRepository();
    this.refreshService = deps?.refreshService ?? createDeliveryRefreshService({
      repository: this.repository,
    });
  }

  async refreshClaim(providerClaimId: string) {
    return this.refreshService.refreshClaim(providerClaimId, {
      source: "recovery",
    });
  }

  async listActiveDeliveries(limit: number) {
    const staleBefore = new Date(Date.now() - getDeliveryRecoveryStaleMs());
    return this.repository.findActiveForRecovery(
      [...ACTIVE_RECOVERY_STATUSES],
      limit,
      { provider: "yandex", staleBefore },
    );
  }
}

export const defaultYandexProviderRecovery = new YandexProviderRecovery();
