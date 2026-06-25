import type { DeliveryProviderCapabilities, OperationsCapabilityMatrix } from "./types/deliveryEngineTypes.js";
import { getDeliveryEnginePlugin } from "./ProviderRegistry.js";

export function resolveProviderCapabilities(
  providerId: string,
): DeliveryProviderCapabilities | null {
  const plugin = getDeliveryEnginePlugin(providerId);
  return plugin?.capabilities ?? null;
}

export function resolveOperationsCapabilityMatrix(
  providerId: string,
  options?: { hasClaimId?: boolean; inRecovery?: boolean },
): OperationsCapabilityMatrix {
  const caps = resolveProviderCapabilities(providerId);
  const hasClaim = options?.hasClaimId ?? false;
  const inRecovery = options?.inRecovery ?? false;

  if (!caps) {
    return {
      refresh: false,
      tracking: false,
      cancel: false,
      returnDelivery: false,
      refund: false,
      schedule: false,
      forceRefresh: false,
      retryRecovery: false,
      openProvider: false,
    };
  }

  return {
    refresh: caps.tracking && hasClaim,
    tracking: caps.tracking,
    cancel: caps.cancelClaim && hasClaim,
    returnDelivery: caps.returnDelivery,
    refund: caps.partialRefund,
    schedule: caps.scheduledDelivery,
    forceRefresh: caps.tracking && hasClaim,
    retryRecovery: inRecovery && caps.tracking,
    openProvider: hasClaim,
  };
}

export function providerSupports(
  providerId: string,
  capability: keyof DeliveryProviderCapabilities,
): boolean {
  const caps = resolveProviderCapabilities(providerId);
  return caps?.[capability] ?? false;
}
