import type { DeliveryEnginePlugin } from "./ports/deliveryEnginePluginPort.js";

const plugins = new Map<string, DeliveryEnginePlugin>();

export function registerDeliveryEnginePlugin(plugin: DeliveryEnginePlugin): void {
  plugins.set(plugin.providerId, plugin);
}

export function getDeliveryEnginePlugin(providerId: string): DeliveryEnginePlugin | null {
  return plugins.get(providerId) ?? null;
}

export function listDeliveryEnginePlugins(): DeliveryEnginePlugin[] {
  return [...plugins.values()];
}

export function listAvailableDeliveryEnginePlugins(): Promise<DeliveryEnginePlugin[]> {
  return Promise.all(
    [...plugins.values()].map(async (p) => ((await p.isAvailable()) ? p : null)),
  ).then((list) => list.filter((p): p is DeliveryEnginePlugin => p != null));
}

export function clearDeliveryEnginePluginsForTests(): void {
  plugins.clear();
}
