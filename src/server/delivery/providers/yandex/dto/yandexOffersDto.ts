/** Yandex API request body (offers/calculate). */
export type YandexOffersCalculateRequestBody = {
  route_points: Array<{
    id: number;
    coordinates: [number, number];
    fullname: string;
  }>;
  items: Array<{
    size?: { length: number; width: number; height: number };
    weight: number;
    quantity: number;
    pickup_point: number;
    dropoff_point: number;
  }>;
  requirements: {
    taxi_classes: string[];
    cargo_type?: string;
    cargo_loaders?: number;
    pro_courier?: boolean;
    cargo_options?: string[];
    skip_door_to_door?: boolean;
    due?: string;
  };
};

export type YandexCalculatedOfferDto = {
  price?: {
    total_price?: string;
    total_price_with_vat?: string;
    base_price?: string;
    surge_ratio?: number;
    currency?: string;
  };
  taxi_class?: string;
  pickup_interval?: { from?: string; to?: string };
  delivery_interval?: { from?: string; to?: string };
  description?: string;
  payload?: string;
  offer_ttl?: string;
};

export type YandexOffersCalculateResponseBody = {
  offers?: YandexCalculatedOfferDto[];
};

export type YandexApiErrorBody = {
  code?: string;
  message?: string;
};
