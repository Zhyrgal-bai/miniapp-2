import { isYandexDeliveryConfigured } from "./services/yandexDeliveryConfig.js";
import { defaultYandexDeliveryPriceService } from "./services/YandexDeliveryPriceService.js";
import { YandexDeliveryProvider } from "./yandexDeliveryProvider.js";
import type { DeliveryEnginePlugin } from "../../engine/ports/deliveryEnginePluginPort.js";
import { registerDeliveryEnginePlugin } from "../../engine/ProviderRegistry.js";
import type { DeliveryPriceCalculateInput } from "../../types/deliveryPriceTypes.js";
import type { ProviderCreateDeliveryInput } from "../deliveryProviderPort.js";

const yandexFulfillment = new YandexDeliveryProvider();

export const yandexDeliveryEnginePlugin: DeliveryEnginePlugin = {
  providerId: "yandex",
  displayName: "Yandex Delivery",
  capabilities: {
    calculatePrice: true,
    createClaim: true,
    acceptClaim: true,
    cancelClaim: false,
    tracking: true,
    webhook: true,
    eta: true,
    liveLocation: true,
    returnDelivery: false,
    cashOnDelivery: false,
    partialRefund: false,
    scheduledDelivery: false,
  },
  isAvailable: () => isYandexDeliveryConfigured(),
  calculatePrice: (input: DeliveryPriceCalculateInput) =>
    defaultYandexDeliveryPriceService.calculate(input),
  createAndAccept: (input: ProviderCreateDeliveryInput) =>
    yandexFulfillment.createAndAccept(input),
};

export function registerYandexDeliveryEnginePlugin(): void {
  registerDeliveryEnginePlugin(yandexDeliveryEnginePlugin);
}
