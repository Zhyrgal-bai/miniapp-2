import type { BusinessType } from "@prisma/client";
import { parseStoreAvailabilitySettings } from "../../../shared/storeAvailabilitySettings.js";
import {
  businessSubscriptionGateSelect,
  canAcceptCustomerOrders,
  type SubscriptionGateFields,
} from "../../subscriptionAccess.js";
import { prisma } from "../../db.js";
import type { DeliveryPriceErrorCode } from "../types/deliveryPriceTypes.js";

export type DeliveryMerchantPickup = {
  merchantId: number;
  address: string;
  coordinates: { latitude: number; longitude: number };
};

export type ResolveDeliveryMerchantSuccess = {
  ok: true;
  pickup: DeliveryMerchantPickup;
};

export type ResolveDeliveryMerchantFailure = {
  ok: false;
  code: DeliveryPriceErrorCode;
  message: string;
};

export type ResolveDeliveryMerchantResult =
  | ResolveDeliveryMerchantSuccess
  | ResolveDeliveryMerchantFailure;

const merchantSelect = {
  latitude: true,
  longitude: true,
  addressLine: true,
  city: true,
  businessType: true,
  storeAvailabilitySettings: true,
  ...businessSubscriptionGateSelect,
} as const;

type MerchantRow = {
  id: number;
  latitude: number | null;
  longitude: number | null;
  addressLine: string | null;
  city: string | null;
  businessType: BusinessType;
  storeAvailabilitySettings: unknown;
} & SubscriptionGateFields;

function isValidPickupCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function buildPickupAddress(row: Pick<MerchantRow, "addressLine" | "city">): string {
  const parts = [row.addressLine?.trim(), row.city?.trim()].filter(
    (p): p is string => Boolean(p && p !== ""),
  );
  return parts.length > 0 ? parts.join(", ") : "Store location";
}

export type DeliveryMerchantResolver = {
  resolve(merchantId: number): Promise<ResolveDeliveryMerchantResult>;
};

export function createDeliveryMerchantResolver(deps?: {
  findBusiness?: (merchantId: number) => Promise<MerchantRow | null>;
}): DeliveryMerchantResolver {
  const findBusiness =
    deps?.findBusiness ??
    ((merchantId: number) =>
      prisma.business.findUnique({
        where: { id: merchantId },
        select: merchantSelect,
      }));

  return {
    async resolve(merchantId: number): Promise<ResolveDeliveryMerchantResult> {
      if (!Number.isInteger(merchantId) || merchantId <= 0) {
        return {
          ok: false,
          code: "merchant_not_found",
          message: "Магазин не найден.",
        };
      }

      const row = await findBusiness(merchantId);
      if (row == null) {
        return {
          ok: false,
          code: "merchant_not_found",
          message: "Магазин не найден.",
        };
      }

      if (!canAcceptCustomerOrders(row)) {
        return {
          ok: false,
          code: "merchant_unavailable",
          message: "Магазин сейчас недоступен для заказов.",
        };
      }

      const availability = parseStoreAvailabilitySettings(
        row.storeAvailabilitySettings,
        row.businessType,
      );
      const deliveryEnabled = availability.ok
        ? availability.value.deliveryEnabled
        : true;

      if (!deliveryEnabled) {
        return {
          ok: false,
          code: "delivery_disabled",
          message: "Доставка в этом магазине отключена.",
        };
      }

      const lat = row.latitude;
      const lng = row.longitude;
      if (lat == null || lng == null || !isValidPickupCoordinate(lat, lng)) {
        return {
          ok: false,
          code: "invalid_coordinates",
          message: "У магазина не указаны координаты для доставки.",
        };
      }

      return {
        ok: true,
        pickup: {
          merchantId: row.id,
          address: buildPickupAddress(row),
          coordinates: { latitude: lat, longitude: lng },
        },
      };
    },
  };
}

export const defaultDeliveryMerchantResolver = createDeliveryMerchantResolver();
