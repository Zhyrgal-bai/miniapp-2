import type { DeliveryProviderOperationsPort } from "./deliveryProviderOperationsPort.js";

class YandexProviderOperations implements DeliveryProviderOperationsPort {
  readonly providerId = "yandex";

  getProviderPortalUrl(_providerClaimId: string): string | null {
    return "https://business.taxi.yandex.ru/";
  }
}

const yandexOps = new YandexProviderOperations();

const registry = new Map<string, DeliveryProviderOperationsPort>([
  ["yandex", yandexOps],
]);

export function getProviderOperations(providerId: string): DeliveryProviderOperationsPort | null {
  return registry.get(providerId) ?? null;
}

export function getProviderPortalUrl(
  providerId: string,
  providerClaimId: string,
): string | null {
  const port = getProviderOperations(providerId);
  if (!port) return null;
  return port.getProviderPortalUrl(providerClaimId);
}

export function listProviderOperations(): DeliveryProviderOperationsPort[] {
  return [...registry.values()];
}
