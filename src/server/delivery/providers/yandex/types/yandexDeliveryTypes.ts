/** ARCHA input for Yandex offers/calculate. */
export type YandexOffersCalculateInput = {
  pickup: {
    address: string;
    coordinates: { longitude: number; latitude: number };
  };
  delivery: {
    address: string;
    coordinates: { longitude: number; latitude: number };
  };
  item: {
    weightKg: number;
    size?: { lengthM: number; widthM: number; heightM: number };
    quantity?: number;
  };
  requirements?: YandexOfferRequirementsInput;
};

export type YandexTaxiClass = "courier" | "express" | "cargo";

export type YandexCargoType = "van" | "lcv_m" | "lcv_l" | "lcv_xl";

export type YandexCargoOption = "thermobag" | "auto_courier";

export type YandexOfferRequirementsInput = {
  taxiClasses?: YandexTaxiClass[];
  cargoType?: YandexCargoType;
  cargoLoaders?: number;
  proCourier?: boolean;
  cargoOptions?: YandexCargoOption[];
  skipDoorToDoor?: boolean;
  due?: string;
};

/** Normalized offer returned to ARCHA callers. */
export type ArchaDeliveryOffer = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  pickupEta: { from: string; to: string } | null;
  deliveryEta: { from: string; to: string } | null;
  payload: string;
  expiresAt: string | null;
};

export type YandexOffersCalculateSuccess = {
  ok: true;
  offers: ArchaDeliveryOffer[];
};

export type YandexOffersCalculateFailure = {
  ok: false;
  code:
    | "not_configured"
    | "validation_error"
    | "timeout"
    | "network_error"
    | "bad_request"
    | "tariffs_unavailable"
    | "rate_limited"
    | "api_error"
    | "empty_offers";
  error: string;
  details?: Record<string, string>;
};

export type YandexOffersCalculateResult =
  | YandexOffersCalculateSuccess
  | YandexOffersCalculateFailure;
