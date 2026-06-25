import { registerYandexDeliveryEnginePlugin } from "../providers/yandex/yandexDeliveryEnginePlugin.js";

let bootstrapped = false;

/** Register all delivery engine plugins (idempotent). */
export function bootstrapDeliveryEngine(): void {
  if (bootstrapped) return;
  registerYandexDeliveryEnginePlugin();
  bootstrapped = true;
}

export function resetDeliveryEngineBootstrapForTests(): void {
  bootstrapped = false;
}

// Auto-register on module load
bootstrapDeliveryEngine();
