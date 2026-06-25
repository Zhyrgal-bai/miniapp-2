import type { DeliveryProviderPort } from "./deliveryProviderPort.js";
import {
  getDeliveryEnginePlugin,
  listDeliveryEnginePlugins,
} from "../engine/ProviderRegistry.js";
import "../engine/deliveryEngineBootstrap.js";

export function getDeliveryProvider(providerId: string): DeliveryProviderPort {
  const plugin = getDeliveryEnginePlugin(providerId);
  if (plugin?.createAndAccept) {
    return {
      providerId: plugin.providerId,
      createAndAccept: (input) => plugin.createAndAccept!(input),
    };
  }
  throw new Error(`Unknown delivery provider: ${providerId}`);
}

export function listDeliveryFulfillmentProviders(): DeliveryProviderPort[] {
  return listDeliveryEnginePlugins()
    .filter((p) => p.capabilities.createClaim && p.createAndAccept)
    .map((p) => ({
      providerId: p.providerId,
      createAndAccept: (input) => p.createAndAccept!(input),
    }));
}
