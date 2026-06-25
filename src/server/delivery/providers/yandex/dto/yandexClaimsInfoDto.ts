/** Yandex claims/info wire DTOs. */

export type YandexClaimsInfoRequestBody = {
  claim_id: string;
};

export type YandexClaimsInfoPerformerInfo = {
  courier_name?: string;
  legal_name?: string;
  car_model?: string;
  car_number?: string;
  car_color?: string;
  transport_type?: string;
};

export type YandexClaimsInfoResponseBody = {
  id?: string;
  claim_id?: string;
  status?: string;
  updated_ts?: string;
  revision?: number;
  performer_info?: YandexClaimsInfoPerformerInfo;
  route_points?: Array<{
    id?: number;
    type?: string;
    visit_status?: string;
    sharing_link?: string;
    address?: {
      coordinates?: [number, number];
    };
  }>;
  same_day_data?: {
    delivery_interval?: {
      from?: string;
      to?: string;
    };
  };
  pricing?: {
    final_price?: string;
    currency?: string;
  };
};
