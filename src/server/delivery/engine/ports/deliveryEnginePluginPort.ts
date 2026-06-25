import type { DeliveryProviderCapabilities } from "../types/deliveryEngineTypes.js";
import type { DeliveryPriceCalculateInput, DeliveryPriceResult } from "../../types/deliveryPriceTypes.js";
import type {
  ProviderCreateDeliveryInput,
  ProviderCreateDeliveryResult,
} from "../../providers/deliveryProviderPort.js";

export interface DeliveryEnginePlugin {
  readonly providerId: string;
  readonly displayName: string;
  readonly capabilities: DeliveryProviderCapabilities;
  isAvailable(): boolean | Promise<boolean>;
  calculatePrice?(input: DeliveryPriceCalculateInput): Promise<DeliveryPriceResult>;
  createAndAccept?(
    input: ProviderCreateDeliveryInput,
  ): Promise<ProviderCreateDeliveryResult>;
}
