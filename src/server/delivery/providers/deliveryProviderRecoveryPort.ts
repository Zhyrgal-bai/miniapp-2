import type { RefreshClaimResult } from "../services/DeliveryRefreshService.js";
import type { ProviderDeliveryRecord } from "../types/providerDeliveryTypes.js";

export type ProviderRefreshResult = RefreshClaimResult;

export interface ProviderRecoveryPort {
  readonly providerId: string;
  refreshClaim(providerClaimId: string): Promise<ProviderRefreshResult>;
  listActiveDeliveries(limit: number): Promise<ProviderDeliveryRecord[]>;
}
