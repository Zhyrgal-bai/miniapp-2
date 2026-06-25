import type { ProviderDeliveryFailureCode } from "../types/providerDeliveryTypes.js";

export type ProviderCreateDeliveryInput = {
  orderId: number;
  merchantId: number;
  buyerUserId: number | null;
  offerPayload: string;
  price: number;
  currency: string;
  pickup: {
    address: string;
    coordinates: { latitude: number; longitude: number };
  };
  delivery: {
    address: string;
    coordinates: { latitude: number; longitude: number };
    contactName: string;
    contactPhone: string;
  };
  weightKg: number;
  requestId?: string;
  correlationId?: string;
};

export type ProviderCreateDeliverySuccess = {
  ok: true;
  providerClaimId: string;
  status: "SEARCHING_COURIER";
  price: number;
  currency: string;
  internalPayload: Record<string, string>;
};

export type ProviderCreateDeliveryFailure = {
  ok: false;
  code: ProviderDeliveryFailureCode;
  message: string;
};

export type ProviderCreateDeliveryResult =
  | ProviderCreateDeliverySuccess
  | ProviderCreateDeliveryFailure;

export interface DeliveryProviderPort {
  readonly providerId: string;
  createAndAccept(
    input: ProviderCreateDeliveryInput,
  ): Promise<ProviderCreateDeliveryResult>;
}
