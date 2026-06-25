/** Yandex claims/create and claims/accept wire DTOs. */

export type YandexClaimsCreateRequestBody = {
  offer_payload: string;
  route_points: Array<{
    id: number;
    coordinates: [number, number];
    fullname: string;
    contact?: {
      name: string;
      phone: string;
    };
  }>;
  items: Array<{
    weight: number;
    quantity: number;
    pickup_point: number;
    dropoff_point: number;
  }>;
  callback_properties?: {
    callback_url: string;
  };
};

export type YandexClaimsCreateResponseBody = {
  id?: string;
  claim_id?: string;
  status?: string;
  version?: number;
};

export type YandexClaimsAcceptRequestBody = {
  claim_id: string;
};

export type YandexClaimsAcceptResponseBody = {
  id?: string;
  claim_id?: string;
  status?: string;
  version?: number;
};

export type YandexClaimsApiErrorBody = {
  code?: string;
  message?: string;
};
