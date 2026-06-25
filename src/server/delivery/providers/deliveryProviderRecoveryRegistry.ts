import type { ProviderRecoveryPort } from "./deliveryProviderRecoveryPort.js";
import { defaultYandexProviderRecovery } from "./yandex/yandexProviderRecovery.js";

const yandexRecovery = defaultYandexProviderRecovery;

export function getProviderRecovery(providerId: string): ProviderRecoveryPort {
  if (providerId === "yandex") return yandexRecovery;
  throw new Error(`Unknown recovery provider: ${providerId}`);
}

export function listRegisteredRecoveryProviders(): ProviderRecoveryPort[] {
  return [yandexRecovery];
}
